# [1.7.0](https://github.com/atomicpages/sensored/compare/v1.6.0...v1.7.0) (2026-10-04)


### Features

* add wrapConsole adapter for console method redaction ([#8](https://github.com/atomicpages/sensored/issues/8)) ([254dc38](https://github.com/atomicpages/sensored/commit/254dc3854e9910d852e955b70ea23432ce22722c))

# [1.6.0](https://github.com/atomicpages/sensored/compare/v1.5.0...v1.6.0) (2026-10-04)


### Features

* add session subsystem with multi-turn PII dedup and hydration ([#7](https://github.com/atomicpages/sensored/issues/7)) ([e6d3c4f](https://github.com/atomicpages/sensored/commit/e6d3c4fd79cea56299da3baee1e36dd53ee529f4))

# [1.5.0](https://github.com/atomicpages/sensored/compare/v1.4.0...v1.5.0) (2026-10-03)


### Features

* add 24 secret detectors ([#6](https://github.com/atomicpages/sensored/issues/6)) ([a1d2b2c](https://github.com/atomicpages/sensored/commit/a1d2b2c2cbb81b45ae3e5c0149feceb3e8b27fa5))

# [1.4.0](https://github.com/atomicpages/sensored/compare/v1.3.0...v1.4.0) (2026-10-02)


### Features

* add http_auth_header and url_query_key detectors ([#5](https://github.com/atomicpages/sensored/issues/5)) ([57af8db](https://github.com/atomicpages/sensored/commit/57af8dbe699865e88e41273214a9a947444dfe9f))

# [1.3.0](https://github.com/atomicpages/sensored/compare/v1.2.0...v1.3.0) (2026-09-30)


### Features

* add browser playground and lazy person_name NER loader ([#3](https://github.com/atomicpages/sensored/issues/3)) ([3654be6](https://github.com/atomicpages/sensored/commit/3654be68cf7eca73350927c7d1bb7686308ac908))

# [1.2.0](https://github.com/atomicpages/sensored/compare/v1.1.0...v1.2.0) (2026-09-30)


### Features

* multi-runtime support (Node.js, Bun, Deno, browser, edge) ([#2](https://github.com/atomicpages/sensored/issues/2)) ([7eeae65](https://github.com/atomicpages/sensored/commit/7eeae6527d16efadc8d47588955dd0189aedee73))

# [1.1.0](https://github.com/atomicpages/sensored/compare/v1.0.0...v1.1.0) (2026-09-30)


### Features

* add bunyan and log4js logger adapters, move loggers to src/loggers/ ([#1](https://github.com/atomicpages/sensored/issues/1)) ([47c2955](https://github.com/atomicpages/sensored/commit/47c2955ccb2daf8eb717d8ceb65fcf1d70b00735))

# 1.0.0 (2026-09-29)


### Bug Fixes

* add build step to CI test job and re-baseline eval corpus ([8001b60](https://github.com/atomicpages/sensored/commit/8001b60ba02bde0cf97f7412a9019bf4770f0926))
* configure trusted publishing with OIDC for npm releases ([2ef1eb9](https://github.com/atomicpages/sensored/commit/2ef1eb95ee3942b6c610971838bb40367e6f0655))
* use SSH deploy key for semantic-release git push ([17bdefc](https://github.com/atomicpages/sensored/commit/17bdefcc99287292e2243c7f8478cad15d893e08))
* use SSH repositoryUrl for semantic-release push ([7974b6e](https://github.com/atomicpages/sensored/commit/7974b6e77184b38aa125911a7b533feee220eadf))


### Features

* add adapters, streaming restore, object traversal, detect-only ([955c670](https://github.com/atomicpages/sensored/commit/955c6700703cc8370407fd074b4ad310bb466947))
* add brand logo assets to repo, README, and docs site ([42344c7](https://github.com/atomicpages/sensored/commit/42344c7821e0a246b8b6a5c24922de7be43f8b61))
* add CLI with architecture-deepened error handling, flag plumbing, and I/O helpers ([1fb2361](https://github.com/atomicpages/sensored/commit/1fb23615d167644a5e876474e5ca9b42f083ebdd))
* **ci:** create GitHub releases and fix OIDC trusted publishing ([e9133ab](https://github.com/atomicpages/sensored/commit/e9133ab65c427b77e2dcbdee857c65a90da71f76))
* initial public release of sensored PII redaction library ([b624d2f](https://github.com/atomicpages/sensored/commit/b624d2f17859c0653df1e4acdc50838a8e95136e))

# 0.0.1 (2026-09-28)

### Bug Fixes

- add build step to CI test job and re-baseline eval corpus
  ([8001b60](https://github.com/atomicpages/sensored/commit/8001b60ba02bde0cf97f7412a9019bf4770f0926))
- configure trusted publishing with OIDC for npm releases
  ([2ef1eb9](https://github.com/atomicpages/sensored/commit/2ef1eb95ee3942b6c610971838bb40367e6f0655))
- use SSH deploy key for semantic-release git push
  ([17bdefc](https://github.com/atomicpages/sensored/commit/17bdefcc99287292e2243c7f8478cad15d893e08))
- use SSH repositoryUrl for semantic-release push
  ([7974b6e](https://github.com/atomicpages/sensored/commit/7974b6e77184b38aa125911a7b533feee220eadf))

### Features

- add brand logo assets to repo, README, and docs site
  ([42344c7](https://github.com/atomicpages/sensored/commit/42344c7821e0a246b8b6a5c24922de7be43f8b61))
- add CLI with architecture-deepened error handling, flag plumbing, and I/O
  helpers
  ([1fb2361](https://github.com/atomicpages/sensored/commit/1fb23615d167644a5e876474e5ca9b42f083ebdd))
- initial public release of sensored PII redaction library
  ([b624d2f](https://github.com/atomicpages/sensored/commit/b624d2f17859c0653df1e4acdc50838a8e95136e))
