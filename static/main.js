function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            evt.preventDefault();
            if ( window.location.href != evt.target.href ) {
                window.history.pushState(null, "", evt.target.href);
                router();
            }
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
    addEventListeners();
    doPolling();
    await sidebarSites();
    initRouter();
}

init();