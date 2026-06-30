# Adapter check fix report

Version: 0.6.3

Fixed from the uploaded checker list:
- Repository/package metadata uses lowercase adapter name `victronadapter`.
- Repository URLs point to `https://github.com/FreeProgrammer1/ioBroker.victronadapter`.
- Removed `@iobroker/repochecker` from dependencies.
- Removed deprecated `common.license`; kept `common.licenseInformation`.
- Updated Admin global dependency to `>=7.6.20`.
- Added all required admin i18n languages in short format.
- Added JSONConfig responsive attributes.
- Added GitHub workflow and Dependabot configuration.
- Added README changelog and final license section with copyright line.
- Removed direct npm/GitHub adapter installation commands from README.
- Added `.commitinfo` to `.gitignore`.
- Added package-lock.json.
- Updated Node engine to `>=22`.
- Updated adapter-core to `^3.4.1`.
- Added lint script and development metadata.
- Fixed Node built-in imports and timer usage without changing adapter behavior.

External items that still require GitHub/npm actions:
- Rename/create the repository as `FreeProgrammer1/ioBroker.victronadapter`.
- Add repository topics in GitHub settings.
- Publish the package on npm before repository inclusion.
- Create a GitHub release after pushing the tag.
