Output demos/out/ingredient-mini-diffs.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/hairline.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --dangerously-skip-permissions --settings ../themes/hairline.settings.json" Enter
Sleep 6s
Type "/look use HL-438"
Sleep 800ms
Enter
Sleep 1s
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test." Enter
Wait+Screen@150s /Turn 1/
Sleep 1500ms
Show
Sleep 2s
Type "/claudinator"
Sleep 800ms
Enter
Sleep 1500ms
Type "d"
Sleep 2500ms
Type "d"
Sleep 2500ms
Escape
Sleep 1s
Hide
Ctrl+C
Ctrl+C
