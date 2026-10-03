Output demos/out/combos.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/hairline.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --dangerously-skip-permissions --settings ../themes/hairline.settings.json" Enter
Sleep 6s
Type "/look hairline"
Sleep 800ms
Enter
Sleep 1s
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test." Enter
Wait+Screen@150s /Turn 1/
Sleep 1500ms
Show
Sleep 1500ms
Type "/claudinator"
Sleep 800ms
Enter
Sleep 1500ms
Type "w"
Sleep 3s
Type "s"
Sleep 3s
Type "o"
Sleep 3s
Type "x"
Sleep 3s
Type "z"
Sleep 3s
Type "w"
Sleep 3s
Escape
Sleep 1s
Hide
Ctrl+C
Ctrl+C
