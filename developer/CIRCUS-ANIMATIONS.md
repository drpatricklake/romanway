# Circus presentation

Trainer, ghost and live rounds now use a compact blue/grey racecourse. Each racer has a faction-colored chariot and a labeled meter showing earned points out of 120. Movement uses the existing authoritative scores; presentation never awards points, changes answers or writes shared data.

Seven dolphin markers turn as the eight questions are completed: floor(completed questions × 7 / 8). The caption explains this symbolic course. No extra questions or timers are introduced. A wrong answer still advances question completion, while its chariot earns no points. Ghost progress is revealed after the student's answer locks; it does not reveal the ghost's current performance while the student is choosing.

Live rounds show the student's own earned points during play. Classmates' answer records remain private. At the finish, the returned scoreboard supplies their actual chariot positions. A host can watch the final comparison. New races reset all markers.

Animations run for 650 ms only when the score or completed-lap count changes. Reduced-motion preferences show the final position immediately. Labels, numeric scores and meter values remain available without animation; names wrap on narrow screens. There is no sound, flashing, new polling or additional network traffic.

Source: developer/circus-motion.js, applied by developer/build.py after the existing integrations. Rebuild with `python developer/build.py`. Existing race regressions now cover dolphins, initial positions, movement, completed races and trainer resets. Browser checks cover a 390px viewport and reduced motion, alongside the existing classroom interactions.
