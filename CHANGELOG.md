# v0.1.2
## 08/27/2026

1. [](#improved)
    * `run_scheduler` now describes what it actually does: it runs every job that has missed its scheduled time, not only the ones due in the current minute. Nothing about the call changed, but the old wording had it looking useless, since a job counts as due only during the exact minute its schedule names

# v0.1.1
## 08/25/2026

1. [](#bugfix)
    * Fixed the pre-flight permission checks on `create_backup` and `list_backups`, which refused keys that hold the `api.system.backup` permission the API actually requires [#2](https://github.com/getgrav/grav-mcp/issues/2) (thanks @sandymac)
    * Fixed `create_environment` to check `api.config.write` and `test_webhook` to check `api.webhooks.write`, matching what the API enforces [#2](https://github.com/getgrav/grav-mcp/issues/2)
    * Fixed `get_dashboard_widgets`, `update_dashboard_layout`, `get_blueprint` (user type) and `manage_api_keys` (list) to stop demanding a narrower permission than the API requires
    * Removed the `label` argument from `create_environment`; the API ignores it and always uses the folder name as the label [#3](https://github.com/getgrav/grav-mcp/issues/3) (thanks @sandymac)
    * Documented the `api.system.backup` permission in the README permission tree

# v0.1.0
## 04/12/2026

1. [](#new)
    * Initial release
