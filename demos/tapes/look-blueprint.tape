Output demos/out/look-blueprint.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/blueprint.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --dangerously-skip-permissions --settings ../themes/blueprint.settings.json" Enter
Sleep 6s
Type "/look use BP-4J0"
Sleep 800ms
Enter
Sleep 1s
Show
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test."
Sleep 500ms
Enter
Wait+Screen@150s /DWG T-01/
Sleep 3s
Hide
Ctrl+C
Ctrl+C
