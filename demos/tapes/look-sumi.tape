Output demos/out/look-sumi.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/sumi.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --dangerously-skip-permissions --settings ../themes/sumi.settings.json" Enter
Sleep 6s
Type "/look use SU-419"
Sleep 800ms
Enter
Sleep 1s
Show
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test."
Sleep 500ms
Enter
Wait+Screen@150s /■ ───/
Sleep 3s
Hide
Ctrl+C
Ctrl+C
