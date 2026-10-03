Output demos/out/look-prism.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/prism.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --dangerously-skip-permissions --settings ../themes/prism.settings.json" Enter
Sleep 6s
Type "/look use PR-46D"
Sleep 800ms
Enter
Sleep 1s
Show
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test."
Sleep 500ms
Enter
Wait+Screen@150s /turn 1/
Sleep 3s
Hide
Ctrl+C
Ctrl+C
