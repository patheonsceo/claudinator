Output demos/out/navigator.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/hairline.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.plugin-under-test --model haiku --permission-mode acceptEdits --allowedTools 'Read,Edit,Write,Glob,Grep,TaskCreate,TaskUpdate,TaskList,TaskGet,TodoWrite,ToolSearch,Bash(node --test:*),Bash(find:*),Bash(ls:*),Bash(cat:*)' --settings ../themes/hairline.settings.json" Enter
Sleep 6s
Type "/look use HL-43H"
Sleep 800ms
Enter
Sleep 1s
Type "Fix total() in src/cart.js so it counts item.qty, then run node --test." Enter
Wait+Screen@150s /Turn 1/
Sleep 1500ms
Type "Now add a test for an empty cart and run node --test again." Enter
Wait+Screen@150s /Turn 2/
Sleep 1500ms
Type "/pin Quantities belong in total(), not in the callers"
Sleep 800ms
Enter
Sleep 1s
Show
Sleep 1500ms
Type "/chapters"
Sleep 800ms
Enter
Sleep 2500ms
Type "l"
Sleep 2500ms
Type "p"
Sleep 2500ms
Type "c"
Sleep 1500ms
Escape
Sleep 1s
Hide
Ctrl+C
Ctrl+C
