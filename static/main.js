function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            showOneMain(evt.target.href);
        });
    });

    document.getElementById("add-feed-btn").addEventListener("click", (evt) => showFeeds(evt));
}

async function init() {
    await openDB();
    showUrlMain();
    addEventListeners();
    doPolling();
    initView();
}

init();