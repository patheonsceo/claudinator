# Contributing to Claudinator

Thanks for wanting to help. Claudinator is a design-led project, so the bar is "it looks and feels right", not only "it works".

## Ways to help

- **Report a bug.** Open an issue with the bug template, and include your Claude Code version, terminal, and whether you run fullscreen mode.
- **Suggest a look or an ingredient.** Use the look request template, and attach a screenshot or mockup if you have one.
- **Send a pull request.** For anything larger than a small fix, open an issue first so we can agree on the approach.

## Development setup

1. Install Claude Code v2.1.287 or later.
2. Clone the repo and load the plugin for one session:
   ```sh
   claude --plugin-dir ./claudinator
   ```
   Saving a file reloads the mod in that session.
3. Before you push, run:
   ```sh
   claude plugin validate --strict .
   claude plugin test .
   ```

## Pull request checklist

- Tests cover the change, and `claude plugin test .` passes.
- `claude plugin validate --strict .` passes.
- A visible change includes a GIF or screenshot in the pull request. A new look or ingredient also adds its demo tape under `demos/`.
- `CHANGELOG.md` has an entry under `[Unreleased]`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for example `feat(looks): add Sumi trace for tool groups`.
- No network requests, and no reading of Claude's history files. See the privacy section of the README.

## Code of conduct

Be kind, assume good intent, and keep feedback about the work. Maintainers may remove comments or contributors that make the project unwelcoming.
