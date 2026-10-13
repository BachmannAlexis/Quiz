# Speech recognition for "Say it!" (optional)

Loaded only when a parent turns on word checking in the parents' page.

- `vosk.js`: [vosk-browser](https://github.com/ccoreilly/vosk-browser) 0.0.8 by Ciaran O'Reilly, a WebAssembly build of
  [Vosk](https://github.com/alphacep/vosk-api). Apache License 2.0.
- `en.tar.gz`, `fr.tar.gz`, `de.tar.gz`, `it.tar.gz`: the Vosk small models `vosk-model-small-en-us-0.15`,
  `vosk-model-small-fr-0.22`, `vosk-model-small-de-0.15` and `vosk-model-small-it-0.22` by Alpha Cephei Inc
  (https://alphacephei.com/vosk/models), unchanged except for the removed README, repacked as `.tar.gz`. Apache License 2.0.

Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0
How to rebuild them: see "Sounds and pictures" in the main README.
