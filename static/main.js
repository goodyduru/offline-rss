function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            showOneMain(evt.target.href);
        });
    });

    document.getElementById("add-feed-btn").addEventListener("click", (evt) => showFeeds(evt));
    document.getElementById("modal-forms").addEventListener("click", (evt) => {
        if ( evt.target.id == "modal-forms" ) {
            evt.target.style.display = "none";
        }
    })
}

async function init() {
    await openDB();
    showUrlMain();
    addEventListeners();
    doPolling();
    initView();
}

init();