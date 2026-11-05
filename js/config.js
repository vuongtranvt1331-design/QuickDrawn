const LEXICALSPACE_CONFIG = {
      projectId: "home-page-d6c39", // Reserved metadata; vocabulary remains IndexedDB-only.
      dbName: "LexicalSpaceDB",
      wordsStore: "words",
      usernameStorageKey: "vocab_user",
      fallbackUsernameKeys: [
        "vocab_user",
        "username",
        "lexicalSpace_username",
        "lexicalspace_username",
        "currentUser",
        "studentUsername",
        "user"
      ],
      wordsCollection: "words"
    };

    const LOCAL_KEYS = {
      BEST_SCORE_PREFIX: "quickDrawn_bestScore_"
    };
