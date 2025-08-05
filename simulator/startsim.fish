#!/usr/bin/env fish
for x in (seq 3);
    fish -c "while true do; RUN_CLIENT=true npm start >>job$x.txt 2>&1; sleep 5; end" &;
end
