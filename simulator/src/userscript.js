// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-07-25
// @description  try to take over the world!
// @author       John2143
// @match        https://openfront.io/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openfront.io
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let oldfetch = fetch;

    // Override openfront.io's fetch function to intercept lobby refresh
    window.fetch = async (url, ...a) => {
        let res = await oldfetch(url, ...a);

        if(url == "/api/public_lobbies") {
            console.log(url, ...a);
            let j = await res.json();
            console.log(j);
            send_to_openfront_pro(j);
            return {
                ok: true,
                json: async () => j,
            };
        }

        return res;
    }
})();


/// Send as post to openfront.pro/api/v1/lobbies
async function send_to_openfront_pro(payload) {
    try {
        let res = await fetch("https://openfront.pro/api/v1/lobbies", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("Failed to send data to openfront.pro:", res.status, res.statusText);
        } else {
            console.log("Data sent successfully to openfront.pro");
        }
    } catch (error) {
        console.error("Error sending data to openfront.pro:", error);
    }
}
