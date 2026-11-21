# Practice prompt and English input fixes

Generated single-form questions now identify the verb, person/number, and the particular tense and voice. The full synopsis heading remains intact in the original exercise. This applies to required practice, voluntary practice, grid input labels and spaced-review cards. The scan covers 429 finite synopsis prompts and 15 participle prompts. Participles request their keyed nominative singular form rather than inheriting an inappropriate finite person or plural number. Answer keys are unchanged.

Example: accipiō, third person plural, perfect passive.

English short-answer input accepts the existing plural expressions y’all, y'all, yall, you all, all of you, and you (pl.). It accepts plain you for second singular; plural drills still require a plural cue. The normalizer now handles common negative contractions with or without an apostrophe, including dont. It also corrects the spacing of canonical you sg / you pl markers. Accepted-key strings are normalized consistently with student input.

Amō already has both love and like in its authored vocabulary entry. Tests confirm I dont like and I don’t like for the negative isolated form when using that entry, while rejecting I like, I did not like, I will not like, I hate and other changes of meaning, tense, number or polarity. No fuzzy synonym substitution is applied to passages. Latin macron policy and Latin answers are unchanged.

The screenshot supplied by the author depicts Classroom pilot checks run 9 (44897247838). Its browser installation failed on Ubuntu 26.04, not on a race assertion. The test runner was pinned to Ubuntu 24.04; replacement run 10 (44897394818) and the merged main run 11 (44900042036) succeeded, including browser checks. The old failed run remains in history and should not be rerun at its obsolete commit.
