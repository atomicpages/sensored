# Changesets

## How to add a changeset

When you make a change that needs a release, run:

```sh
bunx changeset
```

This will prompt you to:

1. Select the package(s) affected
2. Choose bump type (major, minor, patch)
3. Write a summary of the change

The changeset file will be created in `.changeset/` and should be committed
with your change. When a "Version Packages" PR is merged, changesets will
consume all pending changesets, bump versions, update changelogs, and
publish to npm.
