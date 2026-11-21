# NLE accuracy review
November 20, 2026. Source baseline: fce1a4f9c19383bc9fbd3a57934e08c5e1ba5083.

The first editorial pass covered all 1,631 bank entries and 722 questions in 62 predefined sets. It revises 257 bank entries, 34 fixed-set questions, 14 passage lines/subtitles, and seven line glosses. These are revision counts, not counts of incorrect answer keys; many changes improve targeting, context, or distractors. Some fixed-set questions repeat bank entries. The eight official NLE papers supplied by the author informed style and level; the replacement questions are original practice material.

The review found incorrect Latin and explanations, ambiguous choices, target/answer mismatches, and questions testing grammar too early. The fixed Lesson XIV set also had a scoring defect: choosing all 29 correct displayed answers could produce 8/29 because 21 correct positions changed when scoring first rotated the choices. The corrected implementation prepares choices before display.

This defect was not reproduced in the eight-item Lesson XI warm-up of the inspected source. Its eight original keyed meanings were internally consistent, but most questions did not mark their targets. XI's default set and later bank additions have been rechecked and revised. The XIV defect is not a proven explanation of the reported earlier XI attempt.

Examples:
- r383/r409: mīlitibus was underlined, but the key translated parcit as “spares.” Ask for the noun's dative case and object function.
- r146: victūrōs esse, from vincō, has short internal i; vīctūrōs belongs to vīvō.
- r86: tria mīlia, not trēs mīlia.
- x102: gladium is masculine accusative singular.
- b293: Romans were defeated by Gauls at the Allia, not the reverse.
- b48/b414/b236 and XIV Q11: equivalent active/passive English paraphrases were treated as right/wrong alternatives. Target the verb phrase and distinguish its forms.
- x97: fīliī dominī admits more than one reading. Use an unambiguous sentence with fīliōs dominī.
- b311: diēs is usually masculine but has feminine uses.
- b256/b333: deponent perfect participles can have active meaning; avoid an unqualified “always passive.”
- r150/r25: replace the gerundive/deponent before their teaching lessons.
- nle15 Q18: aurī in “armbands of gold” describes material.
- rs13: noceō takes dative eīs, not accusative eōs.
- rs45: vincīrī is passive “be bound”; vincīre is active.
- rs50: Fundanius reports the dinner to Horace; Horace is not an eyewitness diner.
- gt57: a narrator in A.D. 271 cannot describe the recoveries of 272/274 as completed. Set the voice in A.D. 275.

The revised style uses short Latin contexts and underlined targets, including the whole phrase when its English rendering requires a preposition, adjective, auxiliary, or another word. Questions explicitly request a case, function, tense, or construction. Whole-passage comprehension and cultural questions remain appropriate alongside target-word questions.

XI's default set targets vocāvit, multōs annōs, tertiā hōrā, vocāstī, the tense sequence cantābat/clāmāvit, and cotīdiē, followed by two derivatives.

The reference papers span Beginning (2021/2022), Latin I (2016), Latin II (2015/2020), Latin III (2019), and III–IV Prose/Poetry (2018/2017). Advanced papers are not an appropriate difficulty target for XI. Lesson numbers do not directly correspond to NLE exam levels.

Further editorial priorities: map/illustration items; advanced literary and poetry coverage where taught; clear glosses for unfamiliar supporting forms. Some word-lookup and rule-review items remain useful practice. The course bank does not claim to reproduce an official exam's complete syllabus or proportions.

Saved work: questions retain stable IDs. New attempts record a catalogue version, paper revision and question IDs. Changed papers reopen for fresh attempts and archive previous selections; earlier recorded scores are preserved rather than silently recalculated. Unchanged fixed reading sets retain completion. Existing shared Arena checkpoints/ghosts contain frozen question snapshots and are not rewritten; use a fresh checkpoint to move to revised questions.

Validation of the final source passed 6,524 bank-choice round trips, all 722 fixed-set questions, choice rotation before first display, seeded practice, stable IDs, changed/unchanged completion migration, and duplicate-submission checks. A deterministic rebuild and the full classroom suite also passed, including 601 lesson tabs, existing grading/Sentence Lab regressions, Circus, Atrium/Arena, and Firestore emulator tests. Local Chromium could not start; this is not a new live iPhone/Safari or real-Google-account visual test.

The broader word-form dictionary and all Sentence Lab linguistic annotations still warrant a separate editorial review.

Sources:
- [2022 Beginning](https://www.nle.org/_files/ugd/aac38e_36f1747d38e8408795c4415107ca1c53.pdf), [2021 Beginning](https://www.nle.org/_files/ugd/aac38e_05499e7f96084f0db37b90f0372c1f77.pdf), [2020 Latin II](https://www.nle.org/_files/ugd/aac38e_c6b743bfd8714e378bbc5edd98c779af.pdf), [2019 Latin III](https://www.nle.org/_files/ugd/aac38e_f15697adbab943fa9c799e42fbd7d16c.pdf).
- [2018 Prose](https://www.nle.org/_files/ugd/aac38e_27a27b87eb7b4b8a9fad5552efe3b172.pdf), [2017 Poetry](https://www.nle.org/_files/ugd/aac38e_4c6052443a20450da78b2176d6a41d7a.pdf), [2016 Latin I](https://www.nle.org/_files/ugd/aac38e_8cec92c1f5fb43a99515100f09270631.pdf), [2015 Latin II](https://www.nle.org/_files/ugd/aac38e_1159c47fca8f4c5d9c3db7ec7b0c1d68.pdf).
- [Allen and Greenough: deponents](https://dcc.dickinson.edu/grammar/latin/deponent-verbs), [fifth declension](https://dcc.dickinson.edu/grammar/latin/5th-declension-stem-paradigm-and-gender), [dative with special verbs](https://dcc.dickinson.edu/grammar/latin/dative-special-verbs), [genitive](https://dcc.dickinson.edu/grammar/latin/genitive).
- [Livy, Periochae 5.10](https://www.livius.org/sources/content/livy/livy-periochae-1-5/).
- [Suetonius, Julius 4, 6](https://penelope.uchicago.edu/thayer/e/roman/texts/suetonius/12caesars/julius*.html); Plutarch, Caesar 2.
- [Horace, Satires 2.8](https://www.thelatinlibrary.com/horace/serm2.shtml).
- [AIA, Roman Clothing](https://www.archaeological.org/wp-content/uploads/2024/09/Roman-Clothing.pdf).
