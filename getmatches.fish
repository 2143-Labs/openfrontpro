#!/usr/bin/env fish

while true
	curl https://openfront.io/api/public_lobbies >> matches.txt
	echo >> matches.txt
	sleep 15
end
