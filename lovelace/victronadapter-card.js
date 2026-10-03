/*
 * Victron Adapter Lovelace cards
 * Version: 0.8.0
 *
 * This card reads the live values directly from dashboard.* states.
 * No payload_json, no view.*, no fuzzy fallback between AC and Essential.
 */
class VictronAdapterDashboardDirectBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._timer = null;
    this._resolved = {};
  }

  static get DEFAULT_VALUES() {
    const d = 'dashboard';
    const p = 'sensor.victronadapter_0_dashboard';
    return {
      last_update_ms: [`${p}_last_update_ms`, `victronadapter.0.${d}.last_update_ms`],
      grid_total: [`${p}_grid_total`, `victronadapter.0.${d}.grid_total`],
      grid_l1: [`${p}_grid_l1`, `victronadapter.0.${d}.grid_l1`],
      grid_l2: [`${p}_grid_l2`, `victronadapter.0.${d}.grid_l2`],
      grid_l3: [`${p}_grid_l3`, `victronadapter.0.${d}.grid_l3`],
      grid_status: [`${p}_grid_status`, `victronadapter.0.${d}.grid_status`],
      pv_total: [`${p}_pv_total`, `victronadapter.0.${d}.pv_total`],
      pv_ac: [`${p}_pv_ac`, `victronadapter.0.${d}.pv_ac`],
      pv_ac_l1: [`${p}_pv_ac_l1`, `victronadapter.0.${d}.pv_ac_l1`],
      pv_ac_l2: [`${p}_pv_ac_l2`, `victronadapter.0.${d}.pv_ac_l2`],
      pv_ac_l3: [`${p}_pv_ac_l3`, `victronadapter.0.${d}.pv_ac_l3`],
      pv_dc: [`${p}_pv_dc`, `victronadapter.0.${d}.pv_dc`],
      house_total: [`${p}_house_total`, `victronadapter.0.${d}.house_total`],

      // HARD SEPARATION:
      // AC-Lasten only read dashboard.ac_loads_*
      ac_loads_total: [`${p}_ac_loads_total`, `victronadapter.0.${d}.ac_loads_total`],
      ac_loads_l1: [`${p}_ac_loads_l1`, `victronadapter.0.${d}.ac_loads_l1`],
      ac_loads_l2: [`${p}_ac_loads_l2`, `victronadapter.0.${d}.ac_loads_l2`],
      ac_loads_l3: [`${p}_ac_loads_l3`, `victronadapter.0.${d}.ac_loads_l3`],

      // Essentielle Lasten only read dashboard.essential_loads_*
      essential_loads_total: [`${p}_essential_loads_total`, `victronadapter.0.${d}.essential_loads_total`],
      essential_loads_l1: [`${p}_essential_loads_l1`, `victronadapter.0.${d}.essential_loads_l1`],
      essential_loads_l2: [`${p}_essential_loads_l2`, `victronadapter.0.${d}.essential_loads_l2`],
      essential_loads_l3: [`${p}_essential_loads_l3`, `victronadapter.0.${d}.essential_loads_l3`],

      battery_soc: [`${p}_battery_soc`, `victronadapter.0.${d}.battery_soc`],
      battery_power: [`${p}_battery_power`, `victronadapter.0.${d}.battery_power`],
      battery_voltage: [`${p}_battery_voltage`, `victronadapter.0.${d}.battery_voltage`],
      battery_current: [`${p}_battery_current`, `victronadapter.0.${d}.battery_current`],
      battery_temperature: [`${p}_battery_temperature`, `victronadapter.0.${d}.battery_temperature`],
      battery_status: [`${p}_battery_status`, `victronadapter.0.${d}.battery_status`],
      surplus: [`${p}_surplus`, `victronadapter.0.${d}.surplus`],
      ev_power: [`${p}_ev_power`, `victronadapter.0.${d}.ev_power`]
    };
  }

  static getStubConfig() {
    return {
      type: 'custom:victronadapter-flow',
      title: 'Energiefluss',
      subtitle: 'Victron Haussteuerung',
      show_details: true,
      show_debug: false,
      values: VictronAdapterDashboardDirectBase.DEFAULT_VALUES
    };
  }

  setConfig(config) {
    this._config = Object.assign({
      title: 'Energiefluss',
      subtitle: 'Victron Haussteuerung',
      show_details: true,
      show_debug: false,
      transparent_background: true,
      decimals: 0,
      values: {}
    }, config || {});
    this._resolved = {};
    this._requestRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._requestRender();
  }

  connectedCallback() { this._requestRender(); }
  disconnectedCallback() {
    if (this._timer) window.clearTimeout(this._timer);
    this._timer = null;
  }
  getCardSize() { return 6; }

  _requestRender() {
    if (this._timer) window.clearTimeout(this._timer);
    this._timer = window.setTimeout(() => {
      this._timer = null;
      this._renderNow();
    }, 0);
  }

  _normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  _candidateList(value) {
    const rawList = Array.isArray(value) ? value : [value];
    const out = [];
    for (const rawValue of rawList) {
      const raw = String(rawValue || '').trim();
      if (!raw) continue;
      out.push(raw);
      if (!raw.startsWith('sensor.')) {
        const norm = this._normalize(raw);
        out.push(`sensor.${norm}`);
        out.push(`sensor.${norm.replace(/^victron_house_control_0_/, 'victron_house_control_')}`);
      }
    }
    return [...new Set(out)];
  }

  _configured(key) {
    const values = this._config.values || {};
    return values[key] ?? VictronAdapterDashboardDirectBase.DEFAULT_VALUES[key];
  }

  _state(key) {
    if (!this._hass || !this._hass.states) return null;
    const candidates = this._candidateList(this._configured(key));
    for (const entityId of candidates) {
      if (this._hass.states[entityId]) {
        this._resolved[key] = entityId;
        return this._hass.states[entityId];
      }
    }
    this._resolved[key] = `NICHT GEFUNDEN: ${candidates.join(' | ')}`;
    return null;
  }

  _raw(key) {
    const state = this._state(key);
    return state ? state.state : undefined;
  }

  _num(key) {
    const raw = this._raw(key);
    if (raw === undefined || raw === null || raw === '' || raw === 'unknown' || raw === 'unavailable') return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const match = String(raw).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  _text(key, fallback = '') {
    const raw = this._raw(key);
    if (raw === undefined || raw === null || raw === '' || raw === 'unknown' || raw === 'unavailable') return fallback;
    return String(raw);
  }

  _sum(...values) {
    const nums = values.filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0);
  }

  _values() {
    const grid = this._num('grid_total');
    const batteryPower = this._num('battery_power');
    const acL1 = this._num('ac_loads_l1');
    const acL2 = this._num('ac_loads_l2');
    const acL3 = this._num('ac_loads_l3');
    const essL1 = this._num('essential_loads_l1');
    const essL2 = this._num('essential_loads_l2');
    const essL3 = this._num('essential_loads_l3');

    let acTotal = this._num('ac_loads_total');
    let essTotal = this._num('essential_loads_total');
    if (acTotal === null) acTotal = this._sum(acL1, acL2, acL3);
    if (essTotal === null) essTotal = this._sum(essL1, essL2, essL3);

    return {
      lastUpdateMs: this._num('last_update_ms'),
      grid,
      gridL1: this._num('grid_l1'),
      gridL2: this._num('grid_l2'),
      gridL3: this._num('grid_l3'),
      gridStatus: this._text('grid_status', grid < 0 ? 'Einspeisung' : grid > 0 ? 'Netzbezug' : 'Ausgeglichen'),
      pvTotal: this._num('pv_total'),
      pvAc: this._num('pv_ac'),
      pvAcL1: this._num('pv_ac_l1'),
      pvAcL2: this._num('pv_ac_l2'),
      pvAcL3: this._num('pv_ac_l3'),
      pvDc: this._num('pv_dc'),
      houseTotal: this._num('house_total'),
      acTotal, acL1, acL2, acL3,
      essTotal, essL1, essL2, essL3,
      batterySoc: this._num('battery_soc'),
      batteryPower,
      batteryVoltage: this._num('battery_voltage'),
      batteryCurrent: this._num('battery_current'),
      batteryTemp: this._num('battery_temperature'),
      batteryStatus: this._text('battery_status', batteryPower > 0 ? 'Laden' : batteryPower < 0 ? 'Entladen' : 'Standby'),
      surplus: this._num('surplus')
    };
  }

  _fmtPower(value, signed = false) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    const sign = signed && n > 0 ? '+' : '';
    const abs = Math.abs(n);
    if (abs >= 10000) return `${sign}${(n / 1000).toFixed(1).replace('.', ',')} kW`;
    if (abs >= 1000) return `${sign}${(n / 1000).toFixed(2).replace('.', ',')} kW`;
    return `${sign}${n.toFixed(this._config.decimals ?? 0).replace('.', ',')} W`;
  }
  _fmtAbsPower(value) { return value === null || value === undefined ? '—' : this._fmtPower(Math.abs(Number(value))); }
  _fmtPercent(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(0).replace('.', ',')}%`; }
  _fmtVoltage(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(2).replace('.', ',')} V`; }
  _fmtCurrent(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toFixed(1).replace('.', ',')} A`; }

  _timeText(v) {
    const ts = v && Number.isFinite(Number(v.lastUpdateMs)) ? Number(v.lastUpdateMs) : null;
    if (!ts) return '';
    try { return new Date(ts).toLocaleTimeString(this._locale ? this._locale() : [], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; }
  }

  _baseStyles() {
    return `
      :host{display:block;--vhc-blue:#2f9cff;--vhc-text:#f4f8ff;--vhc-muted:rgba(234,243,255,.68)}
      ha-card{border-radius:16px;overflow:hidden;color:var(--vhc-text)}
      .wrap{position:relative;padding:18px;background:radial-gradient(circle at 50% 42%,rgba(18,62,96,.18),rgba(0,0,0,.88) 74%)}
      .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      h3{margin:0;font-size:18px;font-weight:850} h3 small{display:block;margin-top:5px;font-size:12px;color:var(--vhc-muted);font-weight:500}
      .live{font-size:11px;color:var(--vhc-muted);white-space:nowrap}
      .box{border:3px solid var(--vhc-blue);border-radius:14px;background:linear-gradient(180deg,rgba(12,58,94,.96),rgba(10,44,72,.97));padding:22px 28px;box-shadow:0 0 16px rgba(47,156,255,.22);box-sizing:border-box}
      .box .title{font-size:26px;font-weight:500;display:flex;gap:14px;align-items:center}
      .box .main{font-size:54px;font-weight:850;margin:14px 0 22px}
      .box .sub{font-size:22px;color:var(--vhc-muted);margin-top:-4px;margin-bottom:18px}
      .phases div,.kv{display:flex;justify-content:space-between;gap:18px;font-size:24px;line-height:1.35}
      .phases span,.kv span{color:var(--vhc-muted)} .phases b,.kv b{font-weight:850}
      .footer{margin:18px -28px -22px;padding:18px 28px;background:rgba(58,146,214,.92);font-size:28px}
      .footer.charge{background:rgba(45,145,88,.92)}
      .debug{margin-top:14px;font-size:12px;line-height:1.35;color:#d9e7ff;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;white-space:pre-wrap;overflow:auto}
      @media(max-width:760px){.wrap{padding:14px}.box{padding:20px 28px}.box .title{font-size:24px}.box .main{font-size:50px}.box .sub{font-size:21px}.phases div,.kv{font-size:22px}.footer{font-size:25px}}
    `;
  }

  _phaseRows(rows) {
    return `<div class="phases">${rows.map(([label, value]) => `<div><span>${label}</span><b>${this._fmtPower(value)}</b></div>`).join('')}</div>`;
  }


  _flowInfo(v) {
    const grid = Number(v.grid) || 0;
    const batt = Number(v.batteryPower) || 0;
    const pv = Number(v.pvTotal) || 0;
    const ac = Number(v.acTotal) || 0;
    const ess = Number(v.essTotal) || 0;

    return {
      pv: pv > 5 ? 'PV → Anlage' : 'PV inaktiv',
      ac: ac > 5 ? 'Anlage → AC-Lasten' : 'AC-Lasten 0 W',
      ess: ess > 5 ? 'Anlage → Essentielle Lasten' : 'Essentielle Lasten 0 W',
      grid: Math.abs(grid) < 15 ? 'Netz Standby' : grid > 0 ? 'Netz → Anlage' : 'Anlage → Netz',
      batt: Math.abs(batt) < 25 ? 'Akku Standby' : batt > 0 ? 'Anlage → Akku' : 'Akku → Anlage'
    };
  }

  _debugHtml(v) {
    if (!this._config.show_debug) return '';
    const keys = ['ac_loads_total','ac_loads_l1','ac_loads_l2','ac_loads_l3','essential_loads_total','essential_loads_l1','essential_loads_l2','essential_loads_l3'];
    return `<div class="debug">${keys.map(k => `${k} => ${this._resolved[k] || '?'} => ${this._raw(k) ?? '—'}`).join('\n')}</div>`;
  }

  _renderNoData() {
    this.shadowRoot.innerHTML = `<style>${this._baseStyles()}</style><ha-card><div class="wrap"><div class="box"><div class="title">Keine Livewerte</div><div class="sub">dashboard.* Sensoren nicht gefunden</div>${this._debugHtml({})}</div></div></ha-card>`;
  }

  _renderNow() {}
}

class VictronAdapterFlowCard extends VictronAdapterDashboardDirectBase {
  _renderNow() {
    const v = this._values();
    if (!v) return this._renderNoData();
    const battFooter = [this._fmtVoltage(v.batteryVoltage), this._fmtCurrent(v.batteryCurrent), this._fmtPower(v.batteryPower, true)].filter(x => x !== '—').join(' · ');
    this.shadowRoot.innerHTML = `
      <style>${this._baseStyles()}
        .grid{display:grid;grid-template-columns:1fr;gap:22px}
        @media(min-width:900px){.grid{grid-template-columns:1fr 1fr 1fr}.wide{grid-column:span 2}}
      </style>
      <ha-card><div class="wrap"><div class="head"><h3>${this._config.title || 'Energiefluss'}<small>${this._config.subtitle || 'Victron Haussteuerung'}</small></h3><div class="live">Live ${this._timeText(v)}</div></div>
      <div class="grid">
        <section class="box"><div class="title">⚡ Netz</div><div class="main">${this._fmtAbsPower(v.grid)}</div><div class="sub">${v.gridStatus}</div>${this._phaseRows([['L1', v.gridL1], ['L2', v.gridL2], ['L3', v.gridL3]])}</section>
        <section class="box"><div class="title">☀ Solarertrag</div><div class="main">${this._fmtPower(v.pvTotal)}</div><div class="sub">Erzeugung</div><div class="kv"><span>PV AC</span><b>${this._fmtPower(v.pvAc)}</b></div><div class="kv"><span>PV DC</span><b>${this._fmtPower(v.pvDc)}</b></div></section>
        <section class="box"><div class="title">▣ Batterie</div><div class="main">${this._fmtPercent(v.batterySoc)}</div><div class="sub">${v.batteryStatus}</div><div class="footer ${v.batteryPower > 0 ? 'charge' : ''}">${battFooter}</div></section>
        <section class="box"><div class="title">➜ PV-Überschuss</div><div class="main" style="color:#78e27a">${this._fmtPower(v.surplus, true)}</div></section>
        <section class="box"><div class="title">∿ AC-Lasten</div><div class="main">${this._fmtPower(v.acTotal)}</div>${this._phaseRows([['L1', v.acL1], ['L2', v.acL2], ['L3', v.acL3]])}</section>
        <section class="box"><div class="title">⊙ Essentielle Lasten</div><div class="main">${this._fmtPower(v.essTotal)}</div>${this._phaseRows([['L1', v.essL1], ['L2', v.essL2], ['L3', v.essL3]])}</section>
      </div>${this._debugHtml(v)}</div></ha-card>`;
  }
}

class VictronAdapterFlowCircleCard extends VictronAdapterDashboardDirectBase {
  _renderNow() {
    const v = this._values();
    if (!v) return this._renderNoData();

    const battFooter = [this._fmtVoltage(v.batteryVoltage), this._fmtCurrent(v.batteryCurrent)].filter(x => x !== '—').join(' · ');
    const grid = Number(v.grid) || 0;
    const batt = Number(v.batteryPower) || 0;
    const pv = Number(v.pvTotal) || 0;
    const ac = Number(v.acTotal) || 0;
    const ess = Number(v.essTotal) || 0;
    const flow = this._flowInfo(v);

    const pvIdle = pv > 5 ? '' : ' idle';
    const acIdle = ac > 5 ? '' : ' idle';
    const essIdle = ess > 5 ? '' : ' idle';
    const gridClass = Math.abs(grid) < 15 ? ' idle' : grid < 0 ? ' reverse' : '';
    const battClass = Math.abs(batt) < 25 ? ' idle' : batt < 0 ? ' reverse' : '';

    this.shadowRoot.innerHTML = `
      <style>${this._baseStyles()}
        ha-card{background:${this._config.transparent_background === false ? 'var(--ha-card-background,var(--card-background-color,rgba(20,25,32,.20)))' : 'transparent'}}
        .circle-wrap{position:relative;min-height:690px;max-width:900px;margin:0 auto;overflow:hidden;border-radius:18px}
        .circle-bg{position:absolute;left:50%;top:51%;width:390px;height:390px;transform:translate(-50%,-50%);border-radius:50%;border:2px dashed rgba(255,255,255,.18);box-shadow:0 0 60px rgba(90,140,255,.10) inset;z-index:0}
        .node{position:absolute;width:176px;height:176px;border-radius:50%;border:4px solid currentColor;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.16),rgba(20,24,31,.30) 68%);display:flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;padding:18px;z-index:5;box-shadow:0 0 22px currentColor}
        .node .title{font-weight:800;font-size:16px}.node .main{font-size:25px;font-weight:900;margin-top:7px}.node .sub{font-size:12px;color:var(--vhc-muted);margin-top:3px}.node .footer{font-size:11px;margin-top:4px;color:var(--vhc-muted)}
        .node .phases{margin-top:6px}.node .phases div{font-size:11px;line-height:1.35}
        .pv{left:50%;top:4%;transform:translateX(-50%);color:#71e56f}.gridnode{left:3%;top:50%;transform:translateY(-50%);color:#e2e2e5}.acnode{right:3%;top:28%;color:#ff5f6d}.essential{right:3%;bottom:9%;color:#ffad42}.batt{left:50%;bottom:3%;transform:translateX(-50%);color:#42b7ff}
        .hub{position:absolute;left:50%;top:51%;transform:translate(-50%,-50%);width:142px;height:142px;border-radius:50%;background:radial-gradient(circle at 40% 30%,rgba(120,170,255,.96),rgba(33,64,116,.96));border:4px solid rgba(255,255,255,.62);display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:900;z-index:7;box-shadow:0 0 30px rgba(100,160,255,.45)}
        .hub small{position:absolute;bottom:16px;font-size:11px;font-weight:700;color:#fff}.hub:after{content:'';position:absolute;left:33px;right:33px;bottom:39px;height:5px;border-radius:6px;background:#ff8c2d}
        .flow{position:absolute;height:8px;border-radius:999px;background:linear-gradient(90deg,transparent,currentColor,transparent);z-index:2;color:white;opacity:.88;transform-origin:left center}
        .flow:before,.flow:after{content:'';position:absolute;top:50%;left:0;width:13px;height:13px;margin-top:-6.5px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor;animation:vhcFlow 2.2s linear infinite}
        .flow:after{animation-delay:1.1s}.flow.reverse:before,.flow.reverse:after{animation-direction:reverse}
        .flow.idle{opacity:.16;background:currentColor;box-shadow:none}.flow.idle:before,.flow.idle:after{display:none}
        @keyframes vhcFlow{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:calc(100% - 13px);opacity:0}}
        .f-pv{left:50%;top:29%;width:180px;transform:translateX(-50%) rotate(90deg);color:#71e56f}
        .f-grid{left:20%;top:51%;width:235px;transform:rotate(0deg);color:#e2e2e5}
        .f-ac{left:55%;top:41%;width:215px;transform:rotate(-25deg);color:#ff5f6d}
        .f-ess{left:55%;top:61%;width:225px;transform:rotate(27deg);color:#ffad42}
        .f-batt{left:50%;top:67%;width:170px;transform:translateX(-50%) rotate(90deg);color:#42b7ff}
        .flow-label{position:absolute;z-index:8;background:rgba(10,14,24,.74);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:750;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.20)}
        .fl-pv{left:50%;top:25%;transform:translateX(-50%);color:#71e56f}.fl-grid{left:31%;top:46%;transform:translateX(-50%);color:#e2e2e5}.fl-ac{right:24%;top:39%;color:#ff5f6d}.fl-ess{right:22%;top:59%;color:#ffad42}.fl-batt{left:50%;bottom:24%;transform:translateX(-50%);color:#42b7ff}
        .legend{position:absolute;left:50%;top:calc(51% + 94px);transform:translateX(-50%);z-index:9;background:rgba(15,20,30,.46);border-radius:14px;padding:10px 13px;min-width:260px;border:1px solid rgba(255,255,255,.15);font-size:12px;backdrop-filter:blur(8px)}
        .legend div{display:flex;justify-content:space-between;gap:16px;line-height:1.55}.legend span{color:var(--vhc-muted)}.legend b{font-weight:850}
        @media(max-width:760px){
          .circle-wrap{min-height:740px}.circle-bg{width:300px;height:300px}.node{width:138px;height:138px;padding:12px}.node .title{font-size:13px}.node .main{font-size:20px}.node .sub,.node .footer,.node .phases div{font-size:10px}.hub{width:102px;height:102px;font-size:32px}.hub:after{left:24px;right:24px;bottom:29px}.hub small{bottom:8px;font-size:10px}
          .pv{top:2%}.gridnode{left:0}.acnode{right:0;top:27%}.essential{right:0;bottom:10%}.batt{bottom:2%}
          .f-pv{top:25%;width:150px}.f-grid{left:20%;top:51%;width:185px}.f-ac{left:55%;top:41%;width:165px}.f-ess{left:55%;top:61%;width:170px}.f-batt{top:69%;width:145px}
          .flow-label{font-size:10px;padding:5px 7px}.fl-grid{left:30%;top:45%}.fl-ac{right:16%;top:39%}.fl-ess{right:12%;top:59%}.fl-batt{bottom:21%}.legend{top:calc(51% + 72px);min-width:225px;font-size:11px}
        }
      </style>
      <ha-card><div class="wrap">
        <div class="head"><h3>${this._config.title || 'Energiefluss'}<small>${this._config.subtitle || 'Victron Adapter Kreis'} · Richtung aus dashboard.*</small></h3><div class="live">Live ${this._timeText(v)}</div></div>
        <div class="circle-wrap">
          <div class="circle-bg"></div>
          <div class="flow f-pv${pvIdle}" title="${flow.pv}"></div>
          <div class="flow f-grid${gridClass}" title="${flow.grid}"></div>
          <div class="flow f-ac${acIdle}" title="${flow.ac}"></div>
          <div class="flow f-ess${essIdle}" title="${flow.ess}"></div>
          <div class="flow f-batt${battClass}" title="${flow.batt}"></div>

          <div class="flow-label fl-pv">${flow.pv}</div>
          <div class="flow-label fl-grid">${flow.grid}</div>
          <div class="flow-label fl-ac">${flow.ac}</div>
          <div class="flow-label fl-ess">${flow.ess}</div>
          <div class="flow-label fl-batt">${flow.batt}</div>

          <section class="node pv"><div><div class="title">PV</div><div class="main">${this._fmtPower(v.pvTotal)}</div><div class="sub">AC ${this._fmtPower(v.pvAc)} · DC ${this._fmtPower(v.pvDc)}</div></div></section>
          <section class="node gridnode"><div><div class="title">Netz</div><div class="main">${this._fmtAbsPower(v.grid)}</div><div class="sub">${v.gridStatus}</div>${this._phaseRows([['L1', v.gridL1], ['L2', v.gridL2], ['L3', v.gridL3]])}</div></section>
          <section class="node acnode"><div><div class="title">AC-Lasten</div><div class="main">${this._fmtPower(v.acTotal)}</div><div class="sub">dashboard.ac_loads_*</div>${this._phaseRows([['L1', v.acL1], ['L2', v.acL2], ['L3', v.acL3]])}</div></section>
          <section class="node essential"><div><div class="title">Essentiell</div><div class="main">${this._fmtPower(v.essTotal)}</div><div class="sub">dashboard.essential_loads_*</div>${this._phaseRows([['L1', v.essL1], ['L2', v.essL2], ['L3', v.essL3]])}</div></section>
          <section class="node batt"><div><div class="title">Akku</div><div class="main">${this._fmtAbsPower(v.batteryPower)}</div><div class="sub">${this._fmtPercent(v.batterySoc)} · ${v.batteryStatus}</div><div class="footer">${battFooter}</div></div></section>
          <div class="hub">∿<small>Anlage</small></div>
          <div class="legend">
            <div><span>PV</span><b>${this._fmtPower(v.pvTotal)}</b></div>
            <div><span>Netz</span><b>${this._fmtPower(v.grid, true)}</b></div>
            <div><span>Akku</span><b>${this._fmtPower(v.batteryPower, true)}</b></div>
            <div><span>AC</span><b>${this._fmtPower(v.acTotal)}</b></div>
            <div><span>Essentiell</span><b>${this._fmtPower(v.essTotal)}</b></div>
          </div>
        </div>
        ${this._debugHtml(v)}
      </div></ha-card>`;
  }
}

/* ==========================================================================
 * Shared helpers for the 0.8 cards: entity lookup by adapter state path,
 * German/English texts, number formatting and a generic visual editor.
 * ========================================================================== */

const VX_COLORS = {
  pv: '#e08a00', house: '#3a9fd6', grid: '#7d838c', ev: '#9b3fb5', battery: '#2fb344',
  good: '#1f9d55', warning: '#d97706', critical: '#d64545', hub: '#1f5d99'
};

const VX_TEXT = {
  de: {
    energy_flow: 'Energiefluss', production: 'Erzeugung', consumption: 'Verbrauch', grid: 'Netz', import: 'Bezug',
    export: 'Einspeisung', ev: 'Wallbox', charging: 'Lädt', charge: 'Laden', discharge: 'Entladen', standby: 'Standby',
    battery: 'Akku', today: 'Heute', month: 'Monat', year: 'Jahr', since_midnight: 'seit 00:00',
    pv_yield: 'PV-Ertrag', grid_import: 'Netzbezug', grid_export: 'Einspeisung', battery_charged: 'Akku geladen',
    battery_discharged: 'Akku entladen', autarky: 'Autarkie', self_consumption: 'Eigenverbrauch', savings: 'Ersparnis',
    savings_detail: 'davon Eigenverbrauch {a} · Einspeisevergütung {b}', live: 'Live', no_data: 'Keine Livewerte',
    no_data_hint: 'Adapter-Datenpunkte in Lovelace nicht gefunden. Ist die Lovelace-Integration im Adapter aktiviert?',
    full_in: 'voll in ca. {t}', remaining: 'Restlaufzeit ca. {t}', charging_with: 'lädt mit {p}', discharging_with: 'entlädt mit {p}',
    soh: 'Gesundheit (SoH)', cycles: 'Ladezyklen', temperature: 'Temperatur', voltage_current: 'Spannung · Strom',
    capacity: '{c} nutzbar', day_curve: 'Tagesverlauf', forecast: 'PV-Prognose heute {f} · bisher {a} ({p})',
    forecast_none: 'PV heute {a}', soc: 'Akku-Ladezustand', now: 'jetzt', grid_signed: 'Netz (+ Bezug / − Einspeisung)',
    history: 'Historie', best_day: 'bester Tag {d} ({v})', total: 'Summe {v}', no_history: 'Noch keine Historie – sie füllt sich ab heute täglich.',
    gx_connected: 'GX verbunden', gx_offline: 'Keine Daten vom GX', no_alarms: 'Keine Alarme', alarms: '{n} Alarm(e)',
    warnings: '{n} Warnung(en)', grid_ok: 'Netz OK', grid_lost: 'Netzausfall – Inselbetrieb', dess: 'Dynamic ESS',
    dess_off: 'Dynamic ESS ist nicht aktiv', strategy: 'Strategie', target_soc: 'Ziel-Ladezustand', mode: 'Modus',
    restrictions: 'Einschränkungen', feed_in_allowed: 'Einspeisung erlaubt', yes: 'ja', no: 'nein', price_now: 'Strompreis jetzt {p}',
    surplus: 'Überschuss', surplus_green: 'Guter Zeitpunkt für Waschmaschine, Spülmaschine oder Heizstab',
    surplus_yellow: 'Kleine Verbraucher sind jetzt günstig', surplus_red: 'Kein Überschuss – große Verbraucher besser später',
    control: 'Steuerung', confirm_set: '{n} auf „{v}“ setzen?', cancel: 'Abbrechen', confirm: 'Bestätigen',
    control_hint: 'Schreiben muss in der Adapter-Instanz erlaubt sein.', control_missing: 'Keine steuerbaren Datenpunkte gefunden. Lovelace-Integration und Schreiben im Adapter aktivieren.',
    phases: 'Phasen', details_hint: 'Kreis antippen für Details', ac_loads: 'AC-Lasten', essential_loads: 'Essentielle Lasten',
    pv_ac: 'PV AC', pv_dc: 'PV DC', on: 'Ein', off: 'Aus', not_configured: 'nicht konfiguriert'
  },
  en: {
    energy_flow: 'Energy flow', production: 'Production', consumption: 'Consumption', grid: 'Grid', import: 'Import',
    export: 'Feed-in', ev: 'EV charger', charging: 'Charging', charge: 'Charging', discharge: 'Discharging', standby: 'Standby',
    battery: 'Battery', today: 'Today', month: 'Month', year: 'Year', since_midnight: 'since 00:00',
    pv_yield: 'PV yield', grid_import: 'Grid import', grid_export: 'Feed-in', battery_charged: 'Battery charged',
    battery_discharged: 'Battery discharged', autarky: 'Self-sufficiency', self_consumption: 'Self-consumption', savings: 'Savings',
    savings_detail: 'self-consumption {a} · feed-in {b}', live: 'Live', no_data: 'No live values',
    no_data_hint: 'Adapter states not found in Lovelace. Is the Lovelace integration enabled in the adapter?',
    full_in: 'full in approx. {t}', remaining: 'time to go approx. {t}', charging_with: 'charging with {p}', discharging_with: 'discharging with {p}',
    soh: 'State of health', cycles: 'Charge cycles', temperature: 'Temperature', voltage_current: 'Voltage · current',
    capacity: '{c} usable', day_curve: 'Day curve', forecast: 'PV forecast today {f} · so far {a} ({p})',
    forecast_none: 'PV today {a}', soc: 'Battery state of charge', now: 'now', grid_signed: 'Grid (+ import / − feed-in)',
    history: 'History', best_day: 'best day {d} ({v})', total: 'Total {v}', no_history: 'No history yet – it fills up daily from today.',
    gx_connected: 'GX connected', gx_offline: 'No data from GX', no_alarms: 'No alarms', alarms: '{n} alarm(s)',
    warnings: '{n} warning(s)', grid_ok: 'Grid OK', grid_lost: 'Grid lost – island mode', dess: 'Dynamic ESS',
    dess_off: 'Dynamic ESS is not active', strategy: 'Strategy', target_soc: 'Target SoC', mode: 'Mode',
    restrictions: 'Restrictions', feed_in_allowed: 'Feed-in allowed', yes: 'yes', no: 'no', price_now: 'Price now {p}',
    surplus: 'surplus', surplus_green: 'Good time for washing machine, dishwasher or heating rod',
    surplus_yellow: 'Small loads are cheap right now', surplus_red: 'No surplus – better run big loads later',
    control: 'Control', confirm_set: 'Set {n} to "{v}"?', cancel: 'Cancel', confirm: 'Confirm',
    control_hint: 'Writing must be allowed in the adapter instance.', control_missing: 'No controllable states found. Enable the Lovelace integration and writing in the adapter.',
    phases: 'Phases', details_hint: 'Tap a circle for details', ac_loads: 'AC loads', essential_loads: 'Essential loads',
    pv_ac: 'PV AC', pv_dc: 'PV DC', on: 'On', off: 'Off', not_configured: 'not configured'
  }
};

const VxMixin = {
  _lang() {
    const wanted = this._config && this._config.language;
    if (wanted === 'de' || wanted === 'en') return wanted;
    const hassLang = this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language));
    const lang = String(hassLang || (typeof navigator !== 'undefined' ? navigator.language : 'de') || 'de').toLowerCase();
    return lang.startsWith('de') ? 'de' : 'en';
  },
  _t(key, params = {}) {
    const table = VX_TEXT[this._lang()] || VX_TEXT.de;
    let text = table[key] ?? VX_TEXT.en[key] ?? key;
    for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, value);
    return text;
  },
  _locale() { return this._lang() === 'de' ? 'de-DE' : 'en-GB'; },
  _fmtNumber(value, digits = 0) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat(this._locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value));
  },
  /** returns [number, unit] */
  _fmtWatt(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return ['—', ''];
    const n = Number(value); const abs = Math.abs(n);
    if (abs >= 10000) return [this._fmtNumber(n / 1000, 1), 'kW'];
    if (abs >= 1000) return [this._fmtNumber(n / 1000, 2), 'kW'];
    return [this._fmtNumber(n, 0), 'W'];
  },
  _fmtWattText(value) { const [n, u] = this._fmtWatt(value); return u ? `${n} ${u}` : n; },
  _fmtKwh(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return ['—', ''];
    const n = Number(value);
    return [this._fmtNumber(n, Math.abs(n) >= 1000 ? 0 : 1), 'kWh'];
  },
  _fmtEur(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return ['—', ''];
    const n = Number(value);
    return [this._fmtNumber(n, Math.abs(n) >= 1000 ? 0 : 2), this._config.currency || '€'];
  },
  _fmtMinutes(minutes) {
    if (!Number.isFinite(Number(minutes)) || minutes === null) return '—';
    const m = Math.max(0, Math.round(Number(minutes)));
    if (m >= 48 * 60) return `${this._fmtNumber(m / 1440, 1)} d`;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
  },
  _prefix() {
    const instance = String((this._config && this._config.instance) || 'victronadapter.0');
    return instance.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  },
  _namespace() { return String((this._config && this._config.instance) || 'victronadapter.0'); },
  /** Finds the Lovelace entity of an adapter state path such as "statistics.today.pv_kwh". */
  _entPath(path) {
    if (!this._hass || !this._hass.states) return null;
    const override = this._config && this._config.values && this._config.values[path];
    const candidates = [];
    if (override) candidates.push(...(Array.isArray(override) ? override : [override]));
    const name = `${this._prefix()}_${path.replace(/\./g, '_')}`;
    for (const domain of ['sensor', 'binary_sensor', 'input_number', 'input_select', 'switch']) candidates.push(`${domain}.${name}`);
    candidates.push(`${this._namespace()}.${path}`);
    for (const id of candidates) {
      if (this._hass.states[id]) return { id, state: this._hass.states[id] };
    }
    // Fallback: Lovelace may name entities differently (other prefix, manual renaming, other domain).
    // Search for an entity whose id ends with the state path, e.g. "..._dashboard_battery_soc".
    const index = this._entityIndex();
    const suffix = `_${path.replace(/\./g, '_')}`.toLowerCase();
    const found = index.find(id => id.split('.')[1] === suffix.slice(1) || id.endsWith(suffix));
    if (found) return { id: found, state: this._hass.states[found] };
    this._missing = this._missing || new Set();
    this._missing.add(`sensor.${name}`);
    return null;
  },
  /** Entity ids that belong to the adapter (cached per hass object). */
  _entityIndex() {
    if (this._indexFor === this._hass.states) return this._index;
    const prefix = this._prefix();
    const all = Object.keys(this._hass.states);
    const own = all.filter(id => id.includes(prefix) || id.includes('victron'));
    this._indexFor = this._hass.states;
    this._index = own.length ? own : all;
    return this._index;
  },
  /** Diagnostic text shown in a card when values are missing. */
  _diagnostics() {
    if (!this._hass) return '';
    const all = Object.keys(this._hass.states);
    const victron = all.filter(id => id.includes('victron'));
    const missing = [...(this._missing || [])].slice(0, 4);
    const lines = [
      `${this._lang() === 'de' ? 'Gesucht' : 'Searched'}: ${missing.join(', ') || '—'}`,
      `${this._lang() === 'de' ? 'Lovelace-Entitäten gesamt' : 'Lovelace entities total'}: ${all.length}, ${this._lang() === 'de' ? 'davon mit „victron“' : 'containing "victron"'}: ${victron.length}`,
      victron.length ? `${this._lang() === 'de' ? 'Beispiele' : 'Examples'}: ${victron.slice(0, 4).join(', ')}` : ''
    ].filter(Boolean);
    return `<div class="diag">${lines.map(l => this._esc(l)).join('<br>')}</div>`;
  },
  _rawPath(path) {
    const entry = this._entPath(path);
    if (!entry) return undefined;
    const raw = entry.state.state;
    return raw === 'unknown' || raw === 'unavailable' || raw === '' ? undefined : raw;
  },
  _numPath(path) {
    const raw = this._rawPath(path);
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const match = String(raw).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  },
  _jsonPath(path) {
    const raw = this._rawPath(path);
    if (raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },
  _numEntity(entityId) {
    if (!entityId || !this._hass || !this._hass.states[entityId]) return null;
    const match = String(this._hass.states[entityId].state).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  },
  _isStale() {
    const ts = this._numPath('dashboard.last_update_ms');
    if (!ts) return true;
    const limit = Number(this._config.stale_seconds) > 0 ? Number(this._config.stale_seconds) : 60;
    return Date.now() - ts > limit * 1000;
  },
  _esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  _cardStyles() {
    const bg = this._config.transparent_background === true ? 'transparent' : 'var(--ha-card-background, var(--card-background-color, #ffffff))';
    return `
      :host{display:block;--vx-ink:var(--primary-text-color,#1f2328);--vx-muted:var(--secondary-text-color,#6b7280);--vx-line:var(--divider-color,rgba(127,127,127,.2))}
      ha-card{background:${bg};color:var(--vx-ink);border-radius:var(--ha-card-border-radius,16px);overflow:hidden}
      .wrap{padding:14px 16px}
      .head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
      .head h2{font-size:16px;font-weight:600;margin:0}
      .head small{margin-left:auto;font-size:12px;color:var(--vx-muted);text-align:right}
      .muted{color:var(--vx-muted)} .small{font-size:12px}
      .num{font-variant-numeric:tabular-nums}
      .u{font-size:.6em;font-weight:500;color:var(--vx-muted);margin-left:3px}
      .kv{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:6px 0;border-bottom:1px solid var(--vx-line)}
      .kv:last-child{border-bottom:0} .kv span{color:var(--vx-muted)} .kv b{font-variant-numeric:tabular-nums;font-weight:600;text-align:right}
      .tabs{display:inline-flex;border:1px solid var(--vx-line);border-radius:8px;overflow:hidden}
      .tabs button{border:0;background:transparent;color:var(--vx-ink);padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}
      .tabs button.on{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
      .empty{font-size:13px;color:var(--vx-muted);padding:8px 0}
      .diag{margin-top:8px;font-size:11px;line-height:1.5;color:var(--vx-muted);border-top:1px dashed var(--vx-line);padding-top:6px;word-break:break-all}
      .tip{position:absolute;pointer-events:none;background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--vx-ink);border:1px solid var(--vx-line);border-radius:8px;padding:6px 8px;font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,.15);white-space:nowrap;z-index:5;display:none}
      .tip .row{display:flex;align-items:center;gap:6px;line-height:1.5}.tip i{width:10px;height:3px;border-radius:2px;display:inline-block}
    `;
  }
};
Object.assign(VictronAdapterDashboardDirectBase.prototype, VxMixin);

/** Base class for the 0.8 cards. */
class VictronAdapterModernBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._timer = null;
  }
  static get editorSchema() { return [{ name: 'title', type: 'text', label: { de: 'Titel', en: 'Title' } }]; }
  static getConfigElement() {
    const el = document.createElement('victronadapter-card-editor');
    el.schema = this.editorSchema;
    return el;
  }
  setConfig(config) {
    this._config = Object.assign({ language: 'auto' }, this.constructor.defaults || {}, config || {});
    this._built = false;
    this._requestRender();
  }
  set hass(hass) { this._hass = hass; this._requestRender(); }
  get hass() { return this._hass; }
  getCardSize() { return 4; }
  connectedCallback() { this._requestRender(); }
  disconnectedCallback() { if (this._timer) clearTimeout(this._timer); this._timer = null; }
  _requestRender() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; if (this._hass) this._render(); }, 0);
  }
  _render() {}
}
Object.assign(VictronAdapterModernBase.prototype, VxMixin);

/**
 * Generic visual editor (Lovelace "Edit card" dialog). Uses plain inputs so it works with every
 * Lovelace frontend version; fires the standard "config-changed" event.
 */
class VictronAdapterCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._config = {}; this.schema = []; }
  set hass(hass) { this._hass = hass; }
  setConfig(config) { this._config = { ...config }; this._render(); }
  _lang() {
    const l = String((this._hass && this._hass.language) || navigator.language || 'de').toLowerCase();
    return l.startsWith('de') ? 'de' : 'en';
  }
  _render() {
    const lang = this._lang();
    const rows = (this.schema || []).map(field => {
      const label = (field.label && (field.label[lang] || field.label.en)) || field.name;
      const value = this._config[field.name];
      let input;
      if (field.type === 'boolean') {
        input = `<input type="checkbox" data-name="${field.name}" ${value === true || (value === undefined && field.default === true) ? 'checked' : ''}>`;
      } else if (field.type === 'select') {
        input = `<select data-name="${field.name}">${field.options.map(o => `<option value="${o.value}" ${String(value ?? field.default) === String(o.value) ? 'selected' : ''}>${(o.label && (o.label[lang] || o.label.en)) || o.value}</option>`).join('')}</select>`;
      } else if (field.type === 'json') {
        input = `<textarea data-name="${field.name}" data-json="1" rows="4" placeholder='${field.placeholder || ''}'>${value ? JSON.stringify(value, null, 1).replace(/</g, '&lt;') : ''}</textarea>`;
      } else {
        input = `<input type="${field.type === 'number' ? 'number' : 'text'}" data-name="${field.name}" value="${value ?? ''}" placeholder="${field.default ?? ''}" ${field.step ? `step="${field.step}"` : ''}>`;
      }
      return `<label><span>${label}</span>${input}</label>`;
    }).join('');
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font-family:inherit}
      label{display:grid;grid-template-columns:180px 1fr;gap:10px;align-items:center;margin:8px 0;font-size:14px;color:var(--primary-text-color)}
      input[type=text],input[type=number],select,textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--divider-color,#ccc);border-radius:6px;background:var(--card-background-color,#fff);color:var(--primary-text-color);font:inherit}
      textarea{font-family:monospace;font-size:12px}
      .hint{font-size:12px;color:var(--secondary-text-color);margin-top:6px}
    </style>${rows}<div class="hint">${lang === 'de' ? 'Weitere Optionen sind im YAML-Modus möglich (siehe README).' : 'More options are available in YAML mode (see README).'}</div>`;
    this.shadowRoot.querySelectorAll('[data-name]').forEach(el => el.addEventListener('change', () => this._changed(el)));
  }
  _changed(el) {
    const name = el.dataset.name;
    const field = (this.schema || []).find(f => f.name === name) || {};
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else if (el.dataset.json) { try { value = el.value.trim() ? JSON.parse(el.value) : undefined; } catch (e) { return; } }
    else if (field.type === 'number') value = el.value === '' ? undefined : Number(el.value);
    else value = el.value === '' ? undefined : el.value;
    const config = { ...this._config };
    if (value === undefined) delete config[name]; else config[name] = value;
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
}

const VX_LANGUAGE_FIELD = { name: 'language', type: 'select', default: 'auto', label: { de: 'Sprache', en: 'Language' }, options: [{ value: 'auto', label: { de: 'Automatisch', en: 'Automatic' } }, { value: 'de', label: { de: 'Deutsch', en: 'German' } }, { value: 'en', label: { de: 'Englisch', en: 'English' } }] };
const VX_TITLE_FIELD = { name: 'title', type: 'text', label: { de: 'Titel', en: 'Title' } };
const VX_BG_FIELD = { name: 'transparent_background', type: 'boolean', label: { de: 'Transparenter Hintergrund', en: 'Transparent background' } };

/*
 * Hub view: nodes around a central hub with progress rings and animated flow dots
 * (PV top left, house top right, grid left, EV charger right, battery bottom,
 * up to two additional consumers such as a heat pump at the bottom).
 * The DOM is built once; later hass updates only change texts, rings and – when the
 * direction or speed changes – the animated dots, so the animation runs smoothly.
 */
class VictronAdapterFlowHubCard extends VictronAdapterDashboardDirectBase {
  static getStubConfig() {
    return { type: 'custom:victronadapter-flow-hub', pv_peak_w: 10000, show_ev: 'auto', subtract_ev_from_house: false };
  }

  static get editorSchema() {
    return [
      VX_TITLE_FIELD,
      { name: 'pv_peak_w', type: 'number', default: 10000, step: 100, label: { de: 'PV-Spitzenleistung (W)', en: 'PV peak power (W)' } },
      { name: 'show_ev', type: 'select', default: 'auto', label: { de: 'Wallbox anzeigen', en: 'Show EV charger' }, options: [{ value: 'auto', label: { de: 'Automatisch', en: 'Automatic' } }, { value: 'true', label: { de: 'Immer', en: 'Always' } }, { value: 'false', label: { de: 'Nie', en: 'Never' } }] },
      { name: 'subtract_ev_from_house', type: 'boolean', label: { de: 'Wallbox vom Hausverbrauch abziehen', en: 'Subtract EV charger from house' } },
      { name: 'consumers', type: 'json', label: { de: 'Weitere Verbraucher (JSON, max. 2)', en: 'Additional consumers (JSON, max. 2)' }, placeholder: '[{"name":"Wärmepumpe","entity":"sensor.waermepumpe_leistung","icon":"heatpump"}]' },
      VX_LANGUAGE_FIELD,
      VX_BG_FIELD
    ];
  }

  static getConfigElement() { return VictronAdapterModernBase.getConfigElement.call(this); }

  setConfig(config) {
    super.setConfig(Object.assign({ pv_peak_w: 10000, show_ev: 'auto', subtract_ev_from_house: false, background: '', transparent_background: false, language: 'auto', consumers: [] }, config || {}));
    if (!config || !config.title) this._config.title = '';
    this._built = false;
    this._flowSig = {};
    this._selected = null;
  }

  getCardSize() { return 8; }

  _consumers() {
    return (Array.isArray(this._config.consumers) ? this._config.consumers : []).filter(c => c && c.entity).slice(0, 2);
  }

  _geometry() {
    const g = {
      hub: { x: 200, y: 222, r: 28 },
      pv: { x: 92, y: 118, r: 46, color: VX_COLORS.pv },
      house: { x: 308, y: 118, r: 46, color: VX_COLORS.house },
      grid: { x: 66, y: 262, r: 46, color: VX_COLORS.grid },
      ev: { x: 334, y: 262, r: 46, color: VX_COLORS.ev },
      battery: { x: 200, y: 352, r: 46, color: VX_COLORS.battery }
    };
    const slots = [{ x: 338, y: 420 }, { x: 62, y: 420 }];
    const palette = ['#d64545', '#0f8b8d'];
    this._consumers().forEach((c, i) => {
      g[`c${i}`] = { x: slots[i].x, y: slots[i].y, r: 32, color: c.color || palette[i] };
    });
    return g;
  }

  static get ICONS() {
    return {
      pv: '<circle cx="0" cy="0" r="8" fill="none" stroke-width="2.4"/>' +
        [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="0" y1="-13" x2="0" y2="-18" stroke-width="2.4" stroke-linecap="round" transform="rotate(${a})"/>`).join(''),
      house: '<path d="M-17 -1 L0 -16 L17 -1" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M-12 -5 V15 H12 V-5" fill="none" stroke-width="2.6" stroke-linejoin="round"/><path d="M-4 15 V5 H4 V15" fill="none" stroke-width="2.4"/>',
      grid: '<path d="M0 -19 L-10 17 M0 -19 L10 17 M-14 -10 H14 M-11 2 H11 M-7 -10 L7 2 M7 -10 L-7 2 M-11 2 L10 17 M11 2 L-10 17" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      ev: '<path d="M-17 6 V-1 L-12 -11 H12 L17 -1 V6 Z" fill="none" stroke-width="2.4" stroke-linejoin="round"/><path d="M-17 6 V12 H-11 V6 M17 6 V12 H11 V6" fill="none" stroke-width="2.4" stroke-linejoin="round"/><line x1="-17" y1="-1" x2="17" y2="-1" stroke-width="2"/>',
      battery: '<rect x="-20" y="-11" width="36" height="22" rx="3" fill="none" stroke-width="2.4"/><rect x="17" y="-4" width="4" height="8" rx="1" stroke="none"/>',
      heatpump: '<rect x="-14" y="-12" width="28" height="24" rx="3" fill="none" stroke-width="2.2"/><circle cx="-3" cy="0" r="7" fill="none" stroke-width="2"/><path d="M-3 -7 V7 M-10 0 H4" stroke-width="1.6"/><line x1="8" y1="-6" x2="8" y2="6" stroke-width="2"/>',
      heater: '<path d="M-12 12 V-10 M-4 12 V-10 M4 12 V-10 M12 12 V-10" fill="none" stroke-width="2.4" stroke-linecap="round"/><path d="M-16 12 H16" stroke-width="2.4" stroke-linecap="round"/>',
      pool: '<path d="M-16 4 q4 -4 8 0 t8 0 t8 0 t8 0 M-16 11 q4 -4 8 0 t8 0 t8 0 t8 0" fill="none" stroke-width="2.2"/><path d="M-6 -1 V-14 M6 -1 V-14 M-6 -9 H6" fill="none" stroke-width="2.2"/>',
      plug: '<path d="M-6 -14 V-6 M6 -14 V-6 M-11 -6 H11 V2 a11 11 0 0 1 -22 0 Z M0 13 V18" fill="none" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>'
    };
  }

  _styles() {
    const bg = this._config.background
      || (this._config.transparent_background === true ? 'transparent' : 'var(--ha-card-background, var(--card-background-color, #ffffff))');
    return `
      :host{display:block}
      ha-card{background:${bg};color:var(--primary-text-color,#1f2328);border-radius:var(--ha-card-border-radius,16px);overflow:hidden}
      .wrap{padding:14px 12px 10px}
      .head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 6px}
      .title{font-size:17px;font-weight:600}
      .live{font-size:11px;color:var(--secondary-text-color,#8a8f98);white-space:nowrap;display:flex;align-items:center;gap:6px}
      .badge{display:none;align-items:center;gap:4px;font-size:11px;font-weight:600;border-radius:999px;padding:2px 8px;color:#fff}
      svg{display:block;width:100%;max-width:520px;margin:0 auto;overflow:visible}
      .track{fill:none;stroke:var(--divider-color,rgba(127,127,127,.22));stroke-width:3}
      .arc{fill:none;stroke-width:5;stroke-linecap:round;transition:stroke-dasharray .8s ease}
      .node-bg{fill:var(--ha-card-background,var(--card-background-color,#fff))}
      .node{cursor:pointer}
      .node.sel .track{stroke:var(--primary-text-color,#1f2328);stroke-opacity:.35}
      .val{font-size:21px;font-weight:700;fill:var(--primary-text-color,#1f2328);text-anchor:middle;dominant-baseline:middle;font-variant-numeric:tabular-nums}
      .val.small{font-size:17px}
      .unit{font-size:13px;font-weight:500;fill:var(--secondary-text-color,#8a8f98)}
      .sub{font-size:11px;fill:var(--secondary-text-color,#8a8f98);text-anchor:middle;dominant-baseline:middle}
      .line{fill:none;stroke:var(--divider-color,rgba(127,127,127,.22));stroke-width:2.2;stroke-linecap:round;transition:stroke .4s}
      .soc{font-size:11px;font-weight:700;text-anchor:middle;dominant-baseline:central}
      .hidden{display:none}
      .details{margin:4px 6px 2px;border:1px solid var(--divider-color,rgba(127,127,127,.22));border-radius:12px;padding:8px 12px;font-size:12px;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center}
      .details b{font-variant-numeric:tabular-nums}
      .details .muted{color:var(--secondary-text-color,#8a8f98)}
      .debug{margin-top:8px;font-size:11px;white-space:pre-wrap;color:var(--secondary-text-color,#8a8f98)}
    `;
  }

  _endpoints(key) {
    const g = this._geometry();
    const n = g[key]; const h = g.hub;
    const dx = h.x - n.x; const dy = h.y - n.y; const len = Math.hypot(dx, dy);
    const ux = dx / len; const uy = dy / len;
    return { x1: n.x + ux * (n.r + 6), y1: n.y + uy * (n.r + 6), x2: h.x - ux * (h.r + 5), y2: h.y - uy * (h.r + 5) };
  }

  _keys() {
    return ['pv', 'house', 'grid', 'ev', 'battery', ...this._consumers().map((c, i) => `c${i}`)];
  }

  _build() {
    const g = this._geometry();
    const icons = VictronAdapterFlowHubCard.ICONS;
    const keys = this._keys();
    const consumers = this._consumers();
    const lines = keys.map(k => {
      const e = this._endpoints(k);
      return `<g id="flow-${k}"><path id="path-${k}" class="line" d="M${e.x1.toFixed(1)} ${e.y1.toFixed(1)} L${e.x2.toFixed(1)} ${e.y2.toFixed(1)}"/><g id="dots-${k}"></g></g>`;
    }).join('');
    const nodes = keys.map(k => {
      const n = g[k];
      const c = 2 * Math.PI * n.r;
      const consumer = k.startsWith('c') ? consumers[Number(k.slice(1))] : null;
      const iconKey = consumer ? (icons[consumer.icon] ? consumer.icon : 'plug') : k;
      const scale = consumer ? 0.8 : 1;
      const icon = `<g transform="translate(${n.x} ${n.y}) scale(${scale})" stroke="${n.color}" fill="${n.color}">${icons[iconKey]}</g>`;
      const soc = k === 'battery' ? `<text id="soc" class="soc" x="${n.x - 2}" y="${n.y + 0.5}" fill="${n.color}"></text>` : '';
      const top = n.y < g.hub.y;
      const labelY = top ? n.y - n.r - 22 : n.y + n.r + (consumer ? 18 : 24);
      const subY = top ? labelY - 22 : labelY + (consumer ? 17 : 20);
      return `<g id="node-${k}" class="node" data-key="${k}">
        <circle class="node-bg" cx="${n.x}" cy="${n.y}" r="${n.r}"/>
        <circle class="track" cx="${n.x}" cy="${n.y}" r="${n.r}"/>
        <circle id="arc-${k}" class="arc" cx="${n.x}" cy="${n.y}" r="${n.r}" stroke="${n.color}" stroke-dasharray="0 ${c.toFixed(1)}" transform="rotate(-90 ${n.x} ${n.y})"/>
        ${icon}${soc}
        <text id="val-${k}" class="val${consumer ? ' small' : ''}" x="${n.x}" y="${labelY}"></text>
        <text id="sub-${k}" class="sub" x="${n.x}" y="${subY}"></text>
      </g>`;
    }).join('');
    const h = g.hub;
    const height = consumers.length ? 494 : 434;
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style>
      <ha-card><div class="wrap">
        <div class="head"><div class="title" id="title"></div><div class="live"><span class="badge" id="badge"></span><span id="live"></span></div></div>
        <svg viewBox="0 6 400 ${height}" role="img" aria-label="${this._esc(this._t('energy_flow'))}">
          ${lines}
          <g id="hub">
            <circle cx="${h.x}" cy="${h.y}" r="${h.r}" fill="${VX_COLORS.hub}"/>
            <path d="M${h.x + 3} ${h.y - 15} L${h.x - 8} ${h.y + 3} H${h.x + 1} L${h.x - 3} ${h.y + 15} L${h.x + 9} ${h.y - 3} H${h.x} Z" fill="#ffffff"/>
          </g>
          ${nodes}
        </svg>
        <div class="details" id="details"></div>
        <div class="debug" id="debug"></div>
      </div></ha-card>`;
    this.shadowRoot.querySelectorAll('.node').forEach(el => el.addEventListener('click', () => {
      this._selected = this._selected === el.dataset.key ? null : el.dataset.key;
      this._renderNow();
    }));
    this._built = true;
    this._flowSig = {};
  }

  _setText(id, text) {
    const el = this.shadowRoot.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  _setValue(id, watts) {
    const el = this.shadowRoot.getElementById(id);
    if (!el) return;
    const [n, u] = this._fmtWatt(watts);
    const html = u ? `${n}<tspan class="unit" dx="4">${u}</tspan>` : n;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  _setArc(key, fraction) {
    const g = this._geometry()[key];
    const el = this.shadowRoot.getElementById(`arc-${key}`);
    if (!el || !g) return;
    const c = 2 * Math.PI * g.r;
    const f = Math.max(0, Math.min(1, Number(fraction) || 0));
    el.setAttribute('stroke-dasharray', `${(f * c).toFixed(1)} ${c.toFixed(1)}`);
    el.style.opacity = f > 0.005 ? '1' : '0';
  }

  /**
   * @param key node key
   * @param watts absolute power on this line
   * @param towardsHub true when energy flows from the node to the hub
   */
  _setFlow(key, watts, towardsHub) {
    const node = this._geometry()[key];
    if (!node) return;
    const active = Number.isFinite(watts) && Math.abs(watts) >= (this._config.min_flow_w ?? 20);
    const kw = active ? Math.abs(watts) / 1000 : 0;
    const dur = active ? Math.max(0.8, 3.2 - Math.log2(1 + kw) * 0.7) : 0;
    const sig = active ? `${towardsHub ? 'in' : 'out'}:${dur.toFixed(1)}` : 'idle';
    const path = this.shadowRoot.getElementById(`path-${key}`);
    if (path) path.style.stroke = active ? node.color : '';
    if (this._flowSig[key] === sig) return;
    this._flowSig[key] = sig;
    const dots = this.shadowRoot.getElementById(`dots-${key}`);
    if (!dots) return;
    if (!active) { dots.innerHTML = ''; return; }
    const keyPoints = towardsHub ? '0;1' : '1;0';
    dots.innerHTML = [0, 1, 2].map(i => `<circle r="3.6" fill="${node.color}">
        <animateMotion dur="${dur.toFixed(2)}s" begin="${(-i * dur / 3).toFixed(2)}s" repeatCount="indefinite" keyPoints="${keyPoints}" keyTimes="0;1" calcMode="linear"><mpath href="#path-${key}"/></animateMotion>
      </circle>`).join('');
  }

  _detailsHtml(v, ev) {
    const w = x => `<b>${this._fmtWattText(x)}</b>`;
    switch (this._selected) {
      case 'house': {
        const l = [1, 2, 3].map(i => this._numPath(`view.house_l${i}`));
        return `<b>${this._t('consumption')} – ${this._t('phases')}:</b><span>L1 ${w(l[0])}</span><span>L2 ${w(l[1])}</span><span>L3 ${w(l[2])}</span><span class="muted">${this._t('ac_loads')} ${w(v.acTotal)}</span><span class="muted">${this._t('essential_loads')} ${w(v.essTotal)}</span>`;
      }
      case 'grid':
        return `<b>${this._t('grid')} – ${this._t('phases')}:</b><span>L1 ${w(v.gridL1)}</span><span>L2 ${w(v.gridL2)}</span><span>L3 ${w(v.gridL3)}</span>`;
      case 'pv':
        return `<b>PV:</b><span>${this._t('pv_ac')} ${w(v.pvAc)}</span><span>${this._t('pv_dc')} ${w(v.pvDc)}</span><span class="muted">AC L1 ${w(v.pvAcL1)} · L2 ${w(v.pvAcL2)} · L3 ${w(v.pvAcL3)}</span>`;
      case 'battery':
        return `<b>${this._t('battery')}:</b><span>${this._fmtNumber(v.batteryVoltage, 1)} V</span><span>${this._fmtNumber(v.batteryCurrent, 1)} A</span><span>${this._fmtNumber(v.batteryTemp, 1)} °C</span><span>SoC ${this._fmtNumber(v.batterySoc, 0)} %</span>`;
      case 'ev':
        return `<b>${this._t('ev')}:</b><span>${w(ev)}</span>`;
      default:
        if (this._selected && this._selected.startsWith('c')) {
          const c = this._consumers()[Number(this._selected.slice(1))];
          return c ? `<b>${this._esc(c.name || c.entity)}:</b><span>${w(this._numEntity(c.entity))}</span><span class="muted">${this._esc(c.entity)}</span>` : '';
        }
        return `<span class="muted">${this._t('details_hint')}</span>`;
    }
  }

  _renderNow() {
    if (!this._hass) return;
    if (!this._built) this._build();
    const v = this._values();
    const num = x => (Number.isFinite(Number(x)) && x !== null ? Number(x) : null);
    const pv = Math.max(0, num(v.pvTotal) ?? 0);
    const grid = num(v.grid);
    const batt = num(v.batteryPower);
    const evRaw = num(this._num('ev_power'));
    const showEvCfg = String(this._config.show_ev);
    const showEv = showEvCfg === 'true' || (showEvCfg === 'auto' && evRaw !== null);
    const ev = showEv ? Math.max(0, evRaw ?? 0) : 0;
    let house = num(v.houseTotal);
    if (house === null) house = this._sum(v.acTotal, v.essTotal);
    if (house !== null && showEv && this._config.subtract_ev_from_house) house = Math.max(0, house - ev);

    this._setText('title', this._config.title || this._t('energy_flow'));
    const time = this._timeText(v);
    this._setText('live', time ? `${this._t('live')} ${time}` : '');

    // status badge: alarms / stale data
    const badge = this.shadowRoot.getElementById('badge');
    if (badge) {
      const level = this._numPath('dashboard.alarm_level') || 0;
      const count = this._numPath('dashboard.alarm_count') || 0;
      const stale = this._numPath('dashboard.last_update_ms') !== null && this._isStale();
      let text = '';
      let color = '';
      if (stale) { text = this._t('gx_offline'); color = VX_COLORS.critical; }
      else if (count > 0) { text = this._t(level >= 2 ? 'alarms' : 'warnings', { n: count }); color = level >= 2 ? VX_COLORS.critical : VX_COLORS.warning; }
      badge.style.display = text ? 'inline-flex' : 'none';
      badge.style.background = color;
      if (badge.textContent !== `⚠ ${text}`) badge.textContent = `⚠ ${text}`;
    }

    this._setValue('val-pv', pv);
    this._setValue('val-house', house);
    this._setValue('val-grid', grid === null ? null : Math.abs(grid));
    this._setValue('val-ev', ev);
    this._setValue('val-battery', batt === null ? null : Math.abs(batt));
    this._setText('sub-pv', this._t('production'));
    this._setText('sub-house', this._t('consumption'));
    this._setText('sub-grid', grid === null ? '' : grid > 15 ? this._t('import') : grid < -15 ? this._t('export') : this._t('grid'));
    this._setText('sub-ev', ev > 20 ? this._t('charging') : this._t('ev'));
    this._setText('sub-battery', batt === null ? '' : batt > 25 ? this._t('charge') : batt < -25 ? this._t('discharge') : this._t('standby'));
    const soc = num(v.batterySoc);
    this._setText('soc', soc === null ? '' : String(Math.round(soc)));

    const peak = Number(this._config.pv_peak_w) > 0 ? Number(this._config.pv_peak_w) : 10000;
    this._setArc('pv', pv / peak);
    const gridImport = grid !== null && grid > 0 ? grid : 0;
    this._setArc('house', house && house > 0 ? (house - Math.min(house, gridImport)) / house : 0);
    this._setArc('grid', 0);
    this._setArc('ev', ev > 20 ? 1 : 0);
    this._setArc('battery', soc === null ? 0 : soc / 100);

    this._setFlow('pv', pv, true);
    this._setFlow('house', house ?? 0, false);
    this._setFlow('grid', grid === null ? 0 : Math.abs(grid), grid !== null && grid > 0);
    this._setFlow('ev', ev, false);
    this._setFlow('battery', batt === null ? 0 : Math.abs(batt), batt !== null && batt < 0);

    this._consumers().forEach((c, i) => {
      const value = Math.max(0, this._numEntity(c.entity) ?? 0);
      this._setValue(`val-c${i}`, value);
      this._setText(`sub-c${i}`, c.name || c.entity);
      this._setArc(`c${i}`, value > 20 ? 1 : 0);
      this._setFlow(`c${i}`, value, false);
    });

    const evNode = this.shadowRoot.getElementById('node-ev');
    const evFlow = this.shadowRoot.getElementById('flow-ev');
    if (evNode) evNode.classList.toggle('hidden', !showEv);
    if (evFlow) evFlow.classList.toggle('hidden', !showEv);

    this.shadowRoot.querySelectorAll('.node').forEach(el => el.classList.toggle('sel', el.dataset.key === this._selected));
    const details = this.shadowRoot.getElementById('details');
    if (details) {
      const html = this._config.show_details === false ? '' : this._detailsHtml(v, ev);
      if (details.innerHTML !== html) details.innerHTML = html;
      details.style.display = html ? 'flex' : 'none';
    }

    const debug = this.shadowRoot.getElementById('debug');
    if (debug) {
      const text = this._config.show_debug
        ? ['pv_total', 'house_total', 'grid_total', 'battery_power', 'battery_soc', 'ev_power'].map(k => `${k} => ${this._resolved[k] || '?'} => ${this._raw(k) ?? '—'}`).join('\n')
        : '';
      if (debug.textContent !== text) debug.textContent = text;
    }
  }
}

/* ---------------------------------------------------------------- today (1, 2, 6) */
class VictronAdapterTodayCard extends VictronAdapterModernBase {
  static get defaults() { return { period: 'today', show_savings: true }; }
  static getStubConfig() { return { type: 'custom:victronadapter-today' }; }
  static get editorSchema() {
    return [VX_TITLE_FIELD,
      { name: 'period', type: 'select', default: 'today', label: { de: 'Startansicht', en: 'Initial period' }, options: [{ value: 'today', label: { de: 'Heute', en: 'Today' } }, { value: 'month', label: { de: 'Monat', en: 'Month' } }, { value: 'year', label: { de: 'Jahr', en: 'Year' } }] },
      { name: 'show_savings', type: 'boolean', default: true, label: { de: 'Ersparnis anzeigen', en: 'Show savings' } },
      { name: 'currency', type: 'text', default: '€', label: { de: 'Währung', en: 'Currency' } },
      VX_LANGUAGE_FIELD, VX_BG_FIELD];
  }
  getCardSize() { return 5; }
  _ring(value, color) {
    const r = 23; const c = 2 * Math.PI * r; const f = Math.max(0, Math.min(1, (Number(value) || 0) / 100));
    return `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--vx-line)" stroke-width="6"/>${f > 0 ? `<circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/>` : ''}</svg>`;
  }
  _render() {
    const period = this._period || this._config.period || 'today';
    const p = `statistics.${period}`;
    const tiles = [
      ['pv_yield', 'pv_kwh', VX_COLORS.pv], ['consumption', 'consumption_kwh', VX_COLORS.house], ['grid_export', 'grid_export_kwh', VX_COLORS.grid],
      ['grid_import', 'grid_import_kwh', VX_COLORS.grid], ['battery_charged', 'battery_charge_kwh', VX_COLORS.battery], ['battery_discharged', 'battery_discharge_kwh', VX_COLORS.battery]
    ];
    const ev = this._numPath(`${p}.ev_kwh`);
    if (ev !== null && ev > 0) tiles.push(['ev', 'ev_kwh', VX_COLORS.ev]);
    const hasData = this._numPath(`${p}.pv_kwh`) !== null;
    const autarky = this._numPath(`${p}.autarky_percent`);
    const selfc = this._numPath(`${p}.self_consumption_percent`);
    const eur = x => { const [n, u] = this._fmtEur(x); return `${n}<span class="u">${u}</span>`; };
    const sub = { today: this._t('since_midnight'), month: new Date().toLocaleDateString(this._locale(), { month: 'long', year: 'numeric' }), year: String(new Date().getFullYear()) }[period];
    this.shadowRoot.innerHTML = `<style>${this._cardStyles()}
      .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
      .tile{border:1px solid var(--vx-line);border-radius:12px;padding:9px 11px}
      .tile .k{font-size:12px;color:var(--vx-muted);display:flex;gap:6px;align-items:center}.tile .k i{width:8px;height:8px;border-radius:2px;flex:none}
      .tile .v{font-size:21px;font-weight:700;margin-top:3px}
      .rings{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
      .ring{display:flex;align-items:center;gap:10px;border:1px solid var(--vx-line);border-radius:12px;padding:8px 10px}
      .ring .b{font-size:21px;font-weight:700;white-space:nowrap}
      .sav{margin-top:12px;border-top:1px solid var(--vx-line);padding-top:10px}
      .sav .row{display:flex;gap:22px;flex-wrap:wrap}.sav .big{font-size:24px;font-weight:700}
    </style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t(period === 'today' ? 'today' : period))}</h2>
        <small><span class="tabs">${['today', 'month', 'year'].map(k => `<button data-p="${k}" class="${k === period ? 'on' : ''}">${this._t(k)}</button>`).join('')}</span></small></div>
      ${hasData ? `<div class="small muted" style="margin:-6px 0 10px">${this._esc(sub)}</div>
      <div class="tiles">${tiles.map(([label, key, color]) => { const [n, u] = this._fmtKwh(this._numPath(`${p}.${key}`)); return `<div class="tile"><div class="k"><i style="background:${color}"></i>${this._t(label)}</div><div class="v num">${n}<span class="u">${u}</span></div></div>`; }).join('')}</div>
      <div class="rings">
        <div class="ring">${this._ring(autarky, VX_COLORS.good)}<div><div class="small muted">${this._t('autarky')}</div><div class="b num">${this._fmtNumber(autarky, 0)} %</div></div></div>
        <div class="ring">${this._ring(selfc, VX_COLORS.pv)}<div><div class="small muted">${this._t('self_consumption')}</div><div class="b num">${this._fmtNumber(selfc, 0)} %</div></div></div>
      </div>
      ${this._config.show_savings !== false ? `<div class="sav"><div class="small muted" style="margin-bottom:4px">${this._t('savings')}</div><div class="row">
        <div><div class="small muted">${this._t('today')}</div><div class="big num">${eur(this._numPath('statistics.today.savings_eur'))}</div></div>
        <div><div class="small muted">${this._t('month')}</div><div class="big num">${eur(this._numPath('statistics.month.savings_eur'))}</div></div>
        <div><div class="small muted">${this._t('year')}</div><div class="big num">${eur(this._numPath('statistics.year.savings_eur'))}</div></div></div>
        <div class="small muted" style="margin-top:6px">${this._t('savings_detail', { a: this._fmtEur(this._numPath(`${p}.savings_self_eur`)).join(' '), b: this._fmtEur(this._numPath(`${p}.savings_export_eur`)).join(' ') })}</div></div>` : ''}`
      : `<div class="empty">${this._t('no_data_hint')}</div>${this._diagnostics()}`}
    </div></ha-card>`;
    this.shadowRoot.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { this._period = b.dataset.p; this._render(); }));
  }
}

/* ---------------------------------------------------------------- battery (4, 10) */
class VictronAdapterBatteryCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-battery' }; }
  static get editorSchema() { return [VX_TITLE_FIELD, VX_LANGUAGE_FIELD, VX_BG_FIELD]; }
  _render() {
    const soc = this._numPath('dashboard.battery_soc');
    const power = this._numPath('dashboard.battery_power');
    const full = this._numPath('dashboard.battery_time_to_full_min');
    const togo = this._numPath('dashboard.battery_time_to_go_min');
    const cap = this._numPath('dashboard.battery_capacity_kwh');
    let state = this._t('standby'); let color = 'var(--vx-muted)'; let eta = '';
    if (power !== null && power > 25) { state = this._t('charging_with', { p: this._fmtWattText(power) }); color = VX_COLORS.battery; if (full !== null) eta = this._t('full_in', { t: this._fmtMinutes(full) }); }
    if (power !== null && power < -25) { state = this._t('discharging_with', { p: this._fmtWattText(-power) }); color = VX_COLORS.warning; if (togo !== null) eta = this._t('remaining', { t: this._fmtMinutes(togo) }); }
    const v = this._numPath('dashboard.battery_voltage'); const a = this._numPath('dashboard.battery_current');
    const rows = [
      ['soh', this._numPath('dashboard.battery_soh'), x => `${this._fmtNumber(x, 0)} %`],
      ['cycles', this._numPath('dashboard.battery_cycles'), x => this._fmtNumber(x, 0)],
      ['temperature', this._numPath('dashboard.battery_temperature'), x => `${this._fmtNumber(x, 1)} °C`]
    ].filter(r => r[1] !== null);
    this.shadowRoot.innerHTML = `<style>${this._cardStyles()}
      .top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.big{font-size:34px;font-weight:700}
      .bar{height:10px;border-radius:5px;background:var(--vx-line);overflow:hidden;margin:8px 0 8px}.bar div{height:100%;border-radius:5px;background:${VX_COLORS.battery};transition:width .8s}
    </style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t('battery'))}</h2><small>${cap ? this._t('capacity', { c: this._fmtKwh(cap).join(' ') }) : ''}</small></div>
      ${soc === null ? `<div class="empty">${this._t('no_data_hint')}</div>${this._diagnostics()}` : `
      <div class="top"><div class="big num">${this._fmtNumber(soc, 0)}<span class="u"> %</span></div>
        <div style="text-align:right"><div style="font-weight:600;color:${color}">${this._esc(state)}</div><div class="small muted">${this._esc(eta)}</div></div></div>
      <div class="bar"><div style="width:${Math.max(0, Math.min(100, soc))}%"></div></div>
      ${rows.map(([k, val, f]) => `<div class="kv"><span>${this._t(k)}</span><b>${f(val)}</b></div>`).join('')}
      <div class="kv"><span>${this._t('voltage_current')}</span><b>${this._fmtNumber(v, 1)} V · ${this._fmtNumber(a, 1)} A</b></div>`}
    </div></ha-card>`;
  }
}

/* ---------------------------------------------------------------- day chart (3, 13) */
class VictronAdapterDayChartCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-day-chart' }; }
  static get editorSchema() { return [VX_TITLE_FIELD, { name: 'show_soc', type: 'boolean', default: true, label: { de: 'Akku-Ladezustand anzeigen', en: 'Show battery SoC' } }, VX_LANGUAGE_FIELD, VX_BG_FIELD]; }
  getCardSize() { return 6; }
  _render() {
    const curve = this._jsonPath('statistics.day_curve_json');
    const pvToday = this._numPath('statistics.today.pv_kwh');
    const forecast = this._numPath('dashboard.pv_forecast_today_kwh');
    const kwh = x => this._fmtKwh(x).join(' ');
    const sub = forecast ? this._t('forecast', { f: kwh(forecast), a: kwh(pvToday), p: `${this._fmtNumber(forecast > 0 ? (pvToday / forecast) * 100 : 0, 0)} %` }) : this._t('forecast_none', { a: kwh(pvToday) });
    const key = curve ? `${curve.date}|${curve.pv.join(',')}|${curve.consumption.join(',')}|${curve.grid.join(',')}|${(curve.soc || []).join(',')}|${this._lang()}` : 'none';
    if (key === this._lastKey && this._built) { const s = this.shadowRoot.getElementById('sub'); if (s) s.textContent = sub; return; }
    this._lastKey = key; this._built = true;
    const W = 540, H = 210, L = 48, R = 10, T = 14, B = 24;
    const series = curve ? [
      { key: 'pv', label: 'PV', color: VX_COLORS.pv, data: curve.pv },
      { key: 'consumption', label: this._t('consumption'), color: VX_COLORS.house, data: curve.consumption },
      { key: 'grid', label: this._t('grid_signed'), color: VX_COLORS.grid, data: curve.grid }
    ] : [];
    const all = series.flatMap(s => s.data.filter(v => v !== null));
    const rawMax = Math.max(1000, ...all) / 1000; const rawMin = Math.min(0, ...all) / 1000;
    const step = rawMax - rawMin > 20 ? 10 : 5;
    const maxKw = Math.ceil(rawMax / step) * step;
    const minKw = Math.floor(rawMin / step) * step;
    const slots = curve ? curve.pv.length : 288;
    const X = i => L + (i / slots) * (W - L - R);
    const Y = w => T + ((maxKw - w / 1000) / (maxKw - minKw)) * (H - T - B);
    const path = data => { let d = ''; let pen = false; data.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i + 0.5).toFixed(1)} ${Y(v).toFixed(1)}`; pen = true; }); return d; };
    let svg = '';
    for (let kw = minKw; kw <= maxKw; kw += step) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(kw * 1000)}" y2="${Y(kw * 1000)}" stroke="var(--vx-line)" stroke-width="${kw === 0 ? 1.2 : 1}"/><text x="${L - 8}" y="${Y(kw * 1000)}" font-size="11" fill="var(--vx-muted)" text-anchor="end" dominant-baseline="middle">${kw} kW</text>`;
    for (let h = 0; h <= 24; h += 3) svg += `<text x="${X((h * 60) / (curve ? curve.slotMinutes : 5))}" y="${H - 6}" font-size="11" fill="var(--vx-muted)" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`;
    if (curve) {
      const pvPath = path(curve.pv);
      const lastPv = curve.pv.reduce((last, v, i) => (v !== null ? i : last), -1);
      const firstPv = curve.pv.findIndex(v => v !== null);
      if (pvPath && firstPv >= 0) svg += `<path d="${pvPath} L${X(lastPv + 0.5)} ${Y(0)} L${X(firstPv + 0.5)} ${Y(0)} Z" fill="${VX_COLORS.pv}" fill-opacity=".14"/>`;
      for (const s of series) svg += `<path d="${path(s.data)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
      const peakIndex = curve.pv.reduce((best, v, i) => (v !== null && (best < 0 || v > curve.pv[best]) ? i : best), -1);
      if (peakIndex >= 0 && curve.pv[peakIndex] > 0) svg += `<text x="${X(peakIndex + 0.5)}" y="${Y(curve.pv[peakIndex]) - 7}" font-size="11" text-anchor="middle" fill="var(--vx-ink)">${this._fmtWattText(curve.pv[peakIndex])}</text>`;
    }
    let socSvg = '';
    const showSoc = this._config.show_soc !== false && curve && (curve.soc || []).some(v => v !== null);
    if (showSoc) {
      const SH = 74; const Ys = v => 6 + ((100 - v) / 100) * (SH - 16);
      for (const v of [0, 50, 100]) socSvg += `<line x1="${L}" x2="${W - R}" y1="${Ys(v)}" y2="${Ys(v)}" stroke="var(--vx-line)"/><text x="${L - 8}" y="${Ys(v)}" font-size="11" fill="var(--vx-muted)" text-anchor="end" dominant-baseline="middle">${v} %</text>`;
      let d = ''; let pen = false; let last = null;
      curve.soc.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i + 0.5).toFixed(1)} ${Ys(v).toFixed(1)}`; pen = true; last = [i, v]; });
      socSvg += `<path d="${d}" fill="none" stroke="${VX_COLORS.battery}" stroke-width="2"/>`;
      if (last) socSvg += `<circle cx="${X(last[0] + 0.5)}" cy="${Ys(last[1])}" r="4" fill="${VX_COLORS.battery}" stroke="var(--ha-card-background,var(--card-background-color,#fff))" stroke-width="2"/><text x="${X(last[0] + 0.5) + 8}" y="${Ys(last[1])}" font-size="11" dominant-baseline="middle" fill="var(--vx-ink)">${this._fmtNumber(last[1], 0)} %</text>`;
      socSvg = `<div class="legend"><span><i style="background:${VX_COLORS.battery}"></i>${this._t('soc')} (%)</span></div><svg viewBox="0 0 ${W} ${SH}" class="chart">${socSvg}</svg>`;
    }
    this.shadowRoot.innerHTML = `<style>${this._cardStyles()}
      .chart{width:100%;height:auto;display:block;overflow:visible}
      .legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--vx-muted);margin:2px 0 4px}.legend span{display:flex;align-items:center;gap:6px}.legend i{width:14px;height:3px;border-radius:2px;display:inline-block}
      .plot{position:relative}
    </style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t('day_curve'))}</h2><small id="sub">${this._esc(sub)}</small></div>
      ${curve ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${this._esc(s.label)}</span>`).join('')}</div>
      <div class="plot"><svg id="main" viewBox="0 0 ${W} ${H}" class="chart">${svg}<line id="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--vx-ink)" stroke-dasharray="2 3" visibility="hidden"/><rect id="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg><div class="tip" id="tip"></div></div>
      ${socSvg}` : `<div class="empty">${this._t('no_data_hint')}</div>${this._diagnostics()}`}
    </div></ha-card>`;
    if (!curve) return;
    const svgEl = this.shadowRoot.getElementById('main');
    const tip = this.shadowRoot.getElementById('tip');
    const cross = this.shadowRoot.getElementById('cross');
    const hit = this.shadowRoot.getElementById('hit');
    const move = ev => {
      const rect = svgEl.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(slots - 1, Math.floor(((x - L) / (W - L - R)) * slots)));
      if (curve.pv[i] === null && curve.consumption[i] === null) { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); return; }
      const minutes = i * curve.slotMinutes;
      cross.setAttribute('x1', X(i + 0.5)); cross.setAttribute('x2', X(i + 0.5)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}</b>` +
        series.map(s => `<div class="row"><i style="background:${s.color}"></i>${this._esc(s.label)}: <b>${this._fmtWattText(s.data[i])}</b></div>`).join('') +
        (curve.soc && curve.soc[i] !== null ? `<div class="row"><i style="background:${VX_COLORS.battery}"></i>SoC: <b>${this._fmtNumber(curve.soc[i], 0)} %</b></div>` : '');
      tip.style.display = 'block';
      const px = ((X(i + 0.5)) / W) * rect.width;
      tip.style.left = `${Math.min(rect.width - tip.offsetWidth, Math.max(0, px + 10))}px`;
      tip.style.top = '8px';
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); });
  }
}

/* ---------------------------------------------------------------- history (7) */
class VictronAdapterHistoryCard extends VictronAdapterModernBase {
  static get defaults() { return { metric: 'pv', view: 'month' }; }
  static getStubConfig() { return { type: 'custom:victronadapter-history' }; }
  static get editorSchema() {
    return [VX_TITLE_FIELD,
      { name: 'metric', type: 'select', default: 'pv', label: { de: 'Wert', en: 'Value' }, options: [['pv', 'PV-Ertrag', 'PV yield'], ['consumption', 'Verbrauch', 'Consumption'], ['gridExport', 'Einspeisung', 'Feed-in'], ['gridImport', 'Netzbezug', 'Grid import']].map(([value, de, en]) => ({ value, label: { de, en } })) },
      { name: 'view', type: 'select', default: 'month', label: { de: 'Startansicht', en: 'Initial view' }, options: [{ value: 'month', label: { de: 'Monat', en: 'Month' } }, { value: 'year', label: { de: 'Jahr', en: 'Year' } }] },
      VX_LANGUAGE_FIELD, VX_BG_FIELD];
  }
  getCardSize() { return 5; }
  _render() {
    const data = this._jsonPath('statistics.history_json');
    const metric = this._metric || this._config.metric || 'pv';
    const view = this._view || this._config.view || 'month';
    const metricColor = { pv: VX_COLORS.pv, consumption: VX_COLORS.house, gridExport: VX_COLORS.grid, gridImport: VX_COLORS.grid }[metric] || VX_COLORS.pv;
    const labels = { pv: 'pv_yield', consumption: 'consumption', gridExport: 'grid_export', gridImport: 'grid_import' };
    const sig = `${data ? data.date.length + '|' + (data[metric] || []).slice(-1)[0] : 'none'}|${metric}|${view}|${this._offset || 0}|${this._lang()}`;
    if (sig === this._sig) return;
    this._sig = sig;
    let bars = []; let title = '';
    const now = new Date();
    const offset = this._offset || 0;
    if (data && data.date && data.date.length) {
      if (view === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        title = d.toLocaleDateString(this._locale(), { month: 'long', year: 'numeric' });
        for (let day = 1; day <= days; day++) {
          const date = `${prefix}-${String(day).padStart(2, '0')}`;
          const idx = data.date.indexOf(date);
          bars.push({ label: `${day}.`, tip: new Date(d.getFullYear(), d.getMonth(), day).toLocaleDateString(this._locale()), value: idx >= 0 ? data[metric][idx] : null });
        }
      } else {
        const year = now.getFullYear() + offset;
        title = String(year);
        for (let m = 0; m < 12; m++) {
          const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
          let sum = null;
          data.date.forEach((date, i) => { if (date.startsWith(prefix)) sum = (sum || 0) + (data[metric][i] || 0); });
          bars.push({ label: new Date(year, m, 1).toLocaleDateString(this._locale(), { month: 'short' }), tip: new Date(year, m, 1).toLocaleDateString(this._locale(), { month: 'long', year: 'numeric' }), value: sum });
        }
      }
    }
    const values = bars.map(b => b.value).filter(v => v !== null);
    const total = values.reduce((a, b) => a + b, 0);
    const best = values.length ? bars.reduce((b, x) => (x.value !== null && (b === null || x.value > b.value) ? x : b), null) : null;
    const max = Math.max(1, ...values);
    const niceMax = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
    const W = 420, H = 180, L = 36, B = 22, T = 10;
    const bw = (W - L - 4) / Math.max(1, bars.length);
    let svg = '';
    for (const f of [0, 0.5, 1]) { const y = T + (1 - f) * (H - T - B); svg += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--vx-line)"/><text x="${L - 6}" y="${y}" font-size="10" fill="var(--vx-muted)" text-anchor="end" dominant-baseline="middle">${this._fmtNumber(niceMax * f, 0)}</text>`; }
    bars.forEach((b, i) => {
      const x = L + i * bw + 1;
      if (b.value !== null && b.value > 0) {
        const h = (b.value / niceMax) * (H - T - B);
        svg += `<rect class="bar" data-i="${i}" x="${x.toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, (bw - 2) / 2).toFixed(1)}" fill="${metricColor}" fill-opacity="${b === best ? 1 : 0.8}"/>`;
      } else {
        svg += `<rect x="${x.toFixed(1)}" y="${H - B - 2}" width="${Math.max(1, bw - 2).toFixed(1)}" height="2" rx="1" fill="var(--vx-line)"/>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}" fill="transparent"/>`;
      const every = bars.length > 12 ? 5 : 1;
      if (i === 0 || (i + 1) % every === 0) svg += `<text x="${(x + bw / 2 - 1).toFixed(1)}" y="${H - 6}" font-size="10" fill="var(--vx-muted)" text-anchor="middle">${this._esc(b.label)}</text>`;
    });
    const kwh = v => this._fmtKwh(v).join(' ');
    this.shadowRoot.innerHTML = `<style>${this._cardStyles()}
      .nav{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
      .nav button.arrow{border:1px solid var(--vx-line);background:transparent;color:var(--vx-ink);border-radius:8px;width:28px;height:26px;cursor:pointer}
      .plot{position:relative} svg{width:100%;height:auto;display:block}
      select{font:inherit;font-size:12px;border:1px solid var(--vx-line);border-radius:8px;padding:4px 6px;background:transparent;color:var(--vx-ink)}
    </style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t('history'))}</h2><small>${values.length ? this._t('total', { v: kwh(total) }) : ''}</small></div>
      <div class="nav"><button class="arrow" data-o="-1">‹</button><b style="min-width:120px;text-align:center">${this._esc(title)}</b><button class="arrow" data-o="1" ${offset >= 0 ? 'disabled' : ''}>›</button>
        <span class="tabs" style="margin-left:auto">${['month', 'year'].map(k => `<button data-v="${k}" class="${k === view ? 'on' : ''}">${this._t(k)}</button>`).join('')}</span>
        <select id="metric">${Object.entries(labels).map(([k, l]) => `<option value="${k}" ${k === metric ? 'selected' : ''}>${this._t(l)}</option>`).join('')}</select></div>
      ${data && data.date && data.date.length ? `<div class="plot"><svg id="svg" viewBox="0 0 ${W} ${H}">${svg}</svg><div class="tip" id="tip"></div></div>
      <div class="small muted" style="margin-top:4px">${best ? this._t('best_day', { d: this._esc(best.tip), v: kwh(best.value) }) : ''}</div>` : `<div class="empty">${this._t('no_history')}</div>`}
    </div></ha-card>`;
    this.shadowRoot.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => { this._offset = Math.min(0, (this._offset || 0) + Number(b.dataset.o)); this._render(); }));
    this.shadowRoot.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { this._view = b.dataset.v; this._offset = 0; this._render(); }));
    const sel = this.shadowRoot.getElementById('metric');
    if (sel) sel.addEventListener('change', () => { this._metric = sel.value; this._render(); });
    const tip = this.shadowRoot.getElementById('tip'); const svgEl = this.shadowRoot.getElementById('svg');
    this.shadowRoot.querySelectorAll('.hit').forEach(r => {
      r.addEventListener('pointerenter', () => {
        const b = bars[Number(r.dataset.i)];
        tip.innerHTML = `<b>${this._esc(b.tip)}</b><div>${this._t(labels[metric])}: <b>${b.value === null ? '—' : kwh(b.value)}</b></div>`;
        tip.style.display = 'block';
        const rect = svgEl.getBoundingClientRect();
        const px = ((Number(r.getAttribute('x')) + bw / 2) / W) * rect.width;
        tip.style.left = `${Math.min(rect.width - tip.offsetWidth, Math.max(0, px - tip.offsetWidth / 2))}px`;
        tip.style.top = '0px';
      });
      r.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    });
  }
}

/* ---------------------------------------------------------------- status (5) */
class VictronAdapterStatusCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-status' }; }
  static get editorSchema() { return [VX_TITLE_FIELD, { name: 'stale_seconds', type: 'number', default: 60, label: { de: 'Keine Daten nach (s)', en: 'No data after (s)' } }, VX_LANGUAGE_FIELD, VX_BG_FIELD]; }
  getCardSize() { return 1; }
  _render() {
    const stale = this._isStale();
    const alarms = this._jsonPath('dashboard.alarms_json') || [];
    const level = alarms.reduce((m, a) => Math.max(m, a.level || 0), 0);
    const gridLost = alarms.some(a => /grid_lost/.test(a.id || ''));
    const chip = (color, text) => `<span class="chip"><span class="dot" style="background:${color}"></span>${this._esc(text)}</span>`;
    const chips = [
      chip(stale ? VX_COLORS.critical : VX_COLORS.good, this._t(stale ? 'gx_offline' : 'gx_connected')),
      alarms.length ? chip(level >= 2 ? VX_COLORS.critical : VX_COLORS.warning, this._t(level >= 2 ? 'alarms' : 'warnings', { n: alarms.length })) : chip(VX_COLORS.good, this._t('no_alarms')),
      chip(gridLost ? VX_COLORS.critical : VX_COLORS.good, this._t(gridLost ? 'grid_lost' : 'grid_ok'))
    ];
    const list = alarms.map(a => `<div class="kv"><span>${a.level >= 2 ? '⛔' : '⚠'} ${this._esc(a.device)} (Unit ${this._esc(a.unit)})</span><b>${this._esc(a.name)}</b></div>`).join('');
    const html = `<style>${this._cardStyles()}
      .chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--vx-line);border-radius:999px;padding:5px 11px;font-size:13px}
      .dot{width:9px;height:9px;border-radius:50%}
    </style><ha-card><div class="wrap">${this._config.title ? `<div class="head"><h2>${this._esc(this._config.title)}</h2></div>` : ''}<div class="chips">${chips.join('')}</div>${list ? `<div style="margin-top:8px">${list}</div>` : ''}</div></ha-card>`;
    if (html !== this._html) { this._html = html; this.shadowRoot.innerHTML = html; }
  }
}

/* ---------------------------------------------------------------- surplus traffic light (14) */
class VictronAdapterSurplusCard extends VictronAdapterModernBase {
  static get defaults() { return { green_w: 1500, yellow_w: 300, min_soc: 50 }; }
  static getStubConfig() { return { type: 'custom:victronadapter-surplus' }; }
  static get editorSchema() {
    return [VX_TITLE_FIELD,
      { name: 'green_w', type: 'number', default: 1500, step: 100, label: { de: 'Grün ab (W)', en: 'Green from (W)' } },
      { name: 'yellow_w', type: 'number', default: 300, step: 100, label: { de: 'Gelb ab (W)', en: 'Yellow from (W)' } },
      { name: 'min_soc', type: 'number', default: 50, label: { de: 'Akkuladung zählt ab SoC (%)', en: 'Battery charging counts from SoC (%)' } },
      VX_LANGUAGE_FIELD, VX_BG_FIELD];
  }
  getCardSize() { return 2; }
  _render() {
    const grid = this._numPath('dashboard.grid_total');
    const batt = this._numPath('dashboard.battery_power');
    const soc = this._numPath('dashboard.battery_soc');
    // surplus = feed-in + battery charging power once the battery is reasonably full
    const surplus = Math.max(0, -(grid ?? 0)) + ((soc ?? 0) >= Number(this._config.min_soc) ? Math.max(0, batt ?? 0) : 0);
    const level = surplus >= Number(this._config.green_w) ? 'green' : surplus >= Number(this._config.yellow_w) ? 'yellow' : 'red';
    const colors = { red: '#e5484d', yellow: '#f5a524', green: '#2fd06a' };
    const lamp = l => `<i style="background:${level === l ? colors[l] : 'rgba(127,127,127,.35)'};${level === l ? `box-shadow:0 0 8px ${colors[l]}` : ''}"></i>`;
    const tint = { green: 'rgba(31,157,85,.10)', yellow: 'rgba(217,119,6,.10)', red: 'rgba(214,69,69,.08)' }[level];
    const html = `<style>${this._cardStyles()}
      .amp{display:flex;align-items:center;gap:14px;border-radius:12px;padding:12px;background:${tint}}
      .light{display:flex;flex-direction:column;gap:4px;background:#1f2328;padding:6px;border-radius:10px}.light i{width:14px;height:14px;border-radius:50%;display:block}
      .big{font-weight:700;font-size:18px}
    </style><ha-card><div class="wrap">${this._config.title ? `<div class="head"><h2>${this._esc(this._config.title)}</h2></div>` : ''}
      <div class="amp" role="status" aria-label="${level}"><div class="light">${lamp('red')}${lamp('yellow')}${lamp('green')}</div>
      <div><div class="big num">${this._fmtWattText(surplus)} ${this._t('surplus')}</div><div class="small muted">${this._t(`surplus_${level}`)}</div></div></div>
    </div></ha-card>`;
    if (html !== this._html) { this._html = html; this.shadowRoot.innerHTML = html; }
  }
}

/* ---------------------------------------------------------------- dynamic ESS (9) */
class VictronAdapterDessCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-dess' }; }
  static get editorSchema() {
    return [VX_TITLE_FIELD, { name: 'price_entity', type: 'text', label: { de: 'Entität aktueller Strompreis (optional)', en: 'Current price entity (optional)' } }, VX_LANGUAGE_FIELD, VX_BG_FIELD];
  }
  getCardSize() { return 3; }
  _render() {
    const available = this._numPath('system.dynamic_ess_available');
    const active = this._numPath('system.dynamic_ess_active');
    const modeEntity = this._entPath('controls.dynamic_ess_mode');
    const price = this._config.price_entity ? this._numEntity(this._config.price_entity) : null;
    const priceUnit = this._config.price_entity && this._hass.states[this._config.price_entity] ? (this._hass.states[this._config.price_entity].attributes.unit_of_measurement || '€/kWh') : '';
    const rows = [
      [this._t('mode'), modeEntity ? modeEntity.state.state : this._t('not_configured')],
      [this._t('strategy'), this._rawPath('system.dynamic_ess_strategy') ?? '—'],
      [this._t('target_soc'), this._numPath('system.dynamic_ess_target_soc') === null ? '—' : `${this._fmtNumber(this._numPath('system.dynamic_ess_target_soc'), 0)} %`],
      [this._t('feed_in_allowed'), this._numPath('system.dynamic_ess_allow_grid_feed_in') ? this._t('yes') : this._t('no')],
      [this._t('restrictions'), this._rawPath('system.dynamic_ess_restrictions') ?? '—']
    ];
    const html = `<style>${this._cardStyles()}</style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t('dess'))}</h2><small>${price !== null ? this._esc(this._t('price_now', { p: `${this._fmtNumber(price, 3)} ${priceUnit}` })) : ''}</small></div>
      ${available === null && active === null ? `<div class="empty">${this._t('no_data_hint')}</div>${this._diagnostics()}` : !active ? `<div class="empty">${this._t('dess_off')}</div>` : ''}
      ${rows.map(([k, v]) => `<div class="kv"><span>${this._esc(k)}</span><b>${this._esc(v)}</b></div>`).join('')}
    </div></ha-card>`;
    if (html !== this._html) { this._html = html; this.shadowRoot.innerHTML = html; }
  }
}

/* ---------------------------------------------------------------- control (15) */
class VictronAdapterControlCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-control' }; }
  static get editorSchema() {
    return [VX_TITLE_FIELD,
      { name: 'controls', type: 'json', label: { de: 'Steuerpunkte (JSON, optional)', en: 'Controls (JSON, optional)' }, placeholder: '[{"path":"controls.minimum_soc_limit","name":"Mindest-SoC","step":5}]' },
      VX_LANGUAGE_FIELD, VX_BG_FIELD];
  }
  getCardSize() { return 4; }
  _items() {
    if (Array.isArray(this._config.controls) && this._config.controls.length) return this._config.controls;
    const items = [
      { path: 'controls.ess_mode', name: { de: 'ESS-Modus', en: 'ESS mode' } },
      { path: 'controls.minimum_soc_limit', name: { de: 'Mindest-SoC', en: 'Minimum SoC' }, step: 5 },
      { path: 'controls.max_grid_feed_in_w', name: { de: 'Max. Einspeisung', en: 'Max. feed-in' }, step: 100 },
      { path: 'controls.dynamic_ess_mode', name: { de: 'Dynamic ESS', en: 'Dynamic ESS' } },
      { path: 'system.relay_1_state', name: { de: 'GX-Relais 1', en: 'GX relay 1' } },
      { path: 'system.relay_2_state', name: { de: 'GX-Relais 2', en: 'GX relay 2' } }
    ];
    // discovered devices (Unit-ID is not known in advance)
    const prefix = `${this._prefix()}_devices_unit_`;
    for (const id of Object.keys(this._hass.states).sort()) {
      const m = id.match(new RegExp(`^(switch|input_select|input_number)\\.${prefix}(\\d+)_(evcharger_start_stop|evcharger_set_current|vebus_mode|solarcharger_mode)$`));
      if (m) items.push({ entity: id, name: { evcharger_start_stop: { de: 'Wallbox laden', en: 'EV charging' }, evcharger_set_current: { de: 'Wallbox Strom', en: 'EV current' }, vebus_mode: { de: 'Wechselrichter', en: 'Inverter' }, solarcharger_mode: { de: `Laderegler ${m[2]}`, en: `Solar charger ${m[2]}` } }[m[3]] });
    }
    return items;
  }
  _entityOf(item) {
    if (item.entity) return this._hass.states[item.entity] ? { id: item.entity, state: this._hass.states[item.entity] } : null;
    return this._entPath(item.path);
  }
  _call(entityId, value) {
    const domain = entityId.split('.')[0];
    if (domain === 'switch' || domain === 'input_boolean') return this._hass.callService(domain, value ? 'turn_on' : 'turn_off', { entity_id: entityId });
    if (domain === 'input_select') return this._hass.callService('input_select', 'select_option', { entity_id: entityId, option: value });
    return this._hass.callService(domain, 'set_value', { entity_id: entityId, value: Number(value) });
  }
  _render() {
    const items = this._items().map(item => ({ item, ent: this._entityOf(item) })).filter(x => x.ent);
    const pending = this._pending;
    const label = item => this._esc(typeof item.name === 'object' ? (item.name[this._lang()] || item.name.en) : (item.name || ''));
    const row = ({ item, ent }, index) => {
      const s = ent.state; const domain = ent.id.split('.')[0];
      const name = label(item) || this._esc(s.attributes.friendly_name || ent.id);
      let control;
      if (domain === 'input_select') {
        const options = s.attributes.options || [];
        if (options.length > 4 || options.join('').length > 28) {
          control = `<select data-sel="${index}">${options.map(o => `<option value="${this._esc(o)}" ${o === s.state ? 'selected' : ''}>${this._esc(o)}</option>`).join('')}</select>`;
        } else {
          control = `<span class="seg">${options.map(o => `<button data-i="${index}" data-v="${this._esc(o)}" class="${o === s.state ? 'on' : ''}">${this._esc(o)}</button>`).join('')}</span>`;
        }
      } else if (domain === 'switch' || domain === 'input_boolean') {
        control = `<button class="sw ${s.state === 'on' ? 'on' : ''}" data-i="${index}" data-v="${s.state === 'on' ? '' : '1'}" aria-pressed="${s.state === 'on'}"></button>`;
      } else {
        const step = Number(item.step || s.attributes.step || 1);
        const unit = s.attributes.unit_of_measurement || '';
        const val = Number(s.state);
        control = `<span class="num-ctl"><button data-i="${index}" data-v="${val - step}">−</button><b class="num">${this._fmtNumber(val, step < 1 ? 1 : 0)} ${this._esc(unit)}</b><button data-i="${index}" data-v="${val + step}">+</button></span>`;
      }
      return `<div class="ctl"><span>${name}</span>${control}</div>`;
    };
    const confirmBar = pending ? `<div class="confirm"><span>${this._esc(this._t('confirm_set', { n: pending.name, v: pending.label }))}</span><span><button id="no">${this._t('cancel')}</button><button id="yes" class="primary">${this._t('confirm')}</button></span></div>` : '';
    const html = `<style>${this._cardStyles()}
      .ctl{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--vx-line);font-size:13px;flex-wrap:wrap}
      .ctl:last-child{border-bottom:0}
      .seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--vx-line);border-radius:8px;overflow:hidden}
      .seg button{border:0;background:transparent;color:var(--vx-ink);padding:5px 9px;font:inherit;font-size:12px;cursor:pointer}
      .seg button.on{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff)}
      .num-ctl{display:inline-flex;align-items:center;gap:8px}.num-ctl button,.confirm button{border:1px solid var(--vx-line);background:transparent;color:var(--vx-ink);border-radius:8px;min-width:30px;height:28px;cursor:pointer;font:inherit}
      .sw{width:42px;height:24px;border-radius:12px;border:0;background:rgba(127,127,127,.4);position:relative;cursor:pointer}
      .sw:after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
      .sw.on{background:${VX_COLORS.battery}}.sw.on:after{left:21px}
      select{font:inherit;font-size:12px;border:1px solid var(--vx-line);border-radius:8px;padding:5px 6px;background:transparent;color:var(--vx-ink);max-width:100%}
      .confirm{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding:10px;border-radius:10px;background:rgba(217,119,6,.10);font-size:13px}
      .confirm button{padding:0 10px;margin-left:6px}.confirm .primary{background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);border:0}
    </style><ha-card><div class="wrap">
      <div class="head"><h2>${this._esc(this._config.title || this._t('control'))}</h2><small>${this._t('control_hint')}</small></div>
      ${items.length ? items.map(row).join('') : `<div class="empty">${this._t('control_missing')}</div>`}
      ${confirmBar}
    </div></ha-card>`;
    if (html === this._html) return;
    this._html = html;
    this.shadowRoot.innerHTML = html;
    this.shadowRoot.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
      const { item, ent } = items[Number(b.dataset.i)];
      const domain = ent.id.split('.')[0];
      const value = domain === 'switch' ? Boolean(b.dataset.v) : b.dataset.v;
      const shown = domain === 'switch' ? this._t(value ? 'on' : 'off') : domain === 'input_select' ? value : `${this._fmtNumber(Number(value), Number.isInteger(Number(value)) ? 0 : 1)} ${ent.state.attributes.unit_of_measurement || ''}`.trim();
      this._pending = { entity: ent.id, value, name: label(item) || ent.id, label: shown };
      this._render();
    }));
    this.shadowRoot.querySelectorAll('[data-sel]').forEach(sel => sel.addEventListener('change', () => {
      const { item, ent } = items[Number(sel.dataset.sel)];
      this._pending = { entity: ent.id, value: sel.value, name: label(item) || ent.id, label: sel.value };
      this._render();
    }));
    const yes = this.shadowRoot.getElementById('yes'); const no = this.shadowRoot.getElementById('no');
    if (yes) yes.addEventListener('click', () => { const p = this._pending; this._pending = null; this._call(p.entity, p.value); this._render(); });
    if (no) no.addEventListener('click', () => { this._pending = null; this._render(); });
  }
}

/* ---------------------------------------------------------------- mini tile (16) */
class VictronAdapterMiniCard extends VictronAdapterModernBase {
  static getStubConfig() { return { type: 'custom:victronadapter-mini' }; }
  static get editorSchema() { return [{ name: 'navigation_path', type: 'text', label: { de: 'Beim Antippen öffnen (Pfad, optional)', en: 'Open on tap (path, optional)' } }, VX_LANGUAGE_FIELD, VX_BG_FIELD]; }
  getCardSize() { return 1; }
  _render() {
    const pv = this._numPath('dashboard.pv_total');
    const house = this._numPath('dashboard.house_total');
    const grid = this._numPath('dashboard.grid_total');
    const soc = this._numPath('dashboard.battery_soc');
    const batt = this._numPath('dashboard.battery_power');
    const arrow = grid === null ? '' : grid > 15 ? '↓' : grid < -15 ? '↑' : '';
    const battArrow = batt === null ? '' : batt > 25 ? '▲' : batt < -25 ? '▼' : '';
    const item = (color, label, text) => `<span class="it" title="${this._esc(label)}"><i style="background:${color}"></i>${text}</span>`;
    const html = `<style>${this._cardStyles()}
      .row{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:15px;font-weight:600;padding:12px 16px;cursor:${this._config.navigation_path ? 'pointer' : 'default'}}
      .it{display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}.it i{width:10px;height:10px;border-radius:50%;display:inline-block}
    </style><ha-card><div class="row" id="row">
      ${item(VX_COLORS.pv, 'PV', this._fmtWattText(pv))}
      ${item(VX_COLORS.house, this._t('consumption'), this._fmtWattText(house))}
      ${item(VX_COLORS.grid, this._t('grid'), `${this._fmtWattText(grid === null ? null : Math.abs(grid))} ${arrow}`)}
      ${item(VX_COLORS.battery, this._t('battery'), `${this._fmtNumber(soc, 0)} % ${battArrow}`)}
    </div></ha-card>`;
    if (html === this._html) return;
    this._html = html;
    this.shadowRoot.innerHTML = html;
    if (this._config.navigation_path) {
      this.shadowRoot.getElementById('row').addEventListener('click', () => {
        history.pushState(null, '', this._config.navigation_path);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      });
    }
  }
}

/* ---------------------------------------------------------------- registration */
const VX_CARDS = [
  ['victronadapter-flow', VictronAdapterFlowCard, 'Victron Adapter Energiefluss', 'Liest direkt dashboard.* Werte. AC und Essential sind hart getrennt.'],
  ['victronadapter-flow-circle', VictronAdapterFlowCircleCard, 'Victron Adapter Kreis mit Stromrichtung', 'Kreis-Ansicht mit animierten Richtungsflüssen aus dashboard.* Werten.'],
  ['victronadapter-flow-hub', VictronAdapterFlowHubCard, 'Victron Energiefluss kompakt', 'PV, Haus, Netz, Wallbox, Akku und eigene Verbraucher mit animiertem Energiefluss.'],
  ['victronadapter-today', VictronAdapterTodayCard, 'Victron Energie heute / Monat / Jahr', 'Tageswerte in kWh, Autarkie, Eigenverbrauch und Ersparnis.'],
  ['victronadapter-battery', VictronAdapterBatteryCard, 'Victron Akku', 'Ladezustand, Restlaufzeit, Gesundheit, Zyklen, Temperatur.'],
  ['victronadapter-day-chart', VictronAdapterDayChartCard, 'Victron Tagesverlauf', 'PV, Verbrauch, Netz und Akku-Ladezustand über den Tag, mit Prognose.'],
  ['victronadapter-history', VictronAdapterHistoryCard, 'Victron Historie', 'Tage eines Monats bzw. Monate eines Jahres als Balken.'],
  ['victronadapter-status', VictronAdapterStatusCard, 'Victron Status', 'Verbindung, Alarme und Netzstatus.'],
  ['victronadapter-surplus', VictronAdapterSurplusCard, 'Victron Überschuss-Ampel', 'Zeigt, ob jetzt ein guter Zeitpunkt für große Verbraucher ist.'],
  ['victronadapter-dess', VictronAdapterDessCard, 'Victron Dynamic ESS', 'Modus, Strategie und Ziel-Ladezustand von Dynamic ESS.'],
  ['victronadapter-control', VictronAdapterControlCard, 'Victron Steuerung', 'ESS-Modus, Mindest-SoC, Einspeisung, Relais und Wallbox mit Sicherheitsabfrage.'],
  ['victronadapter-mini', VictronAdapterMiniCard, 'Victron Mini-Kachel', 'PV, Haus, Netz und Akku in einer Zeile.']
];
if (!customElements.get('victronadapter-card-editor')) customElements.define('victronadapter-card-editor', VictronAdapterCardEditor);
for (const [type, cls] of VX_CARDS) {
  if (!customElements.get(type)) customElements.define(type, cls);
}
window.customCards = window.customCards || [];
for (const [type, , name, description] of VX_CARDS) {
  if (!window.customCards.some(existing => existing && existing.type === type)) {
    window.customCards.push({ type, name, description, preview: true });
  }
}
