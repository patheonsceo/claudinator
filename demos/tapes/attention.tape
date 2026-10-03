Output demos/out/attention.gif
Require claude
Source demos/tapes/_settings.tape
Source demos/themes/hairline.tape

Hide
Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.. --model haiku --settings ../themes/hairline.settings.json" Enter
Sleep 6s
Type "/look use HL-43H"
Sleep 800ms
Enter
Sleep 1s
Type "Create a file notes.txt containing the word hello." Enter
Wait+Screen@90s /Do you want/
Show
Sleep 4s
Hide
Sleep 24s
Show
Sleep 6s
Escape
Hide
Ctrl+C
Ctrl+C
