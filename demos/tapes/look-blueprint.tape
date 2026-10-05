Output demos/out/look-blueprint.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/blueprint.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.plugin-under-test --model haiku --permission-mode acceptEdits --allowedTools 'Read,Edit,Write,Glob,Grep,TaskCreate,TaskUpdate,TaskList,TaskGet,TodoWrite,ToolSearch,Bash(node --test:*),Bash(find:*),Bash(ls:*),Bash(cat:*)' --settings ../themes/blueprint.settings.json" Enter
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
