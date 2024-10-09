function addEventListeners() {
    const pinBtn = document.querySelector('.pin');
    const closeBtn = document.querySelector('.close');
    const barsBtn = document.querySelector('.bars');
    const wrapper = document.querySelector('body > .wrapper');
    const links = document.querySelectorAll("aside a");
    const addFeedBtn = document.getElementById("add-feed-btn");
    const searchInput = document.getElementById("query");

    pinBtn.addEventListener('click', () => {
        wrapper.classList.add('sidebar-open');
    });

    barsBtn.addEventListener('click', () => {
        wrapper.classList.add('sidebar-open');
    });

    closeBtn.addEventListener('click', () => {
        wrapper.classList.remove('sidebar-open');
    });

    links.forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            evt.preventDefault();
            if ( window.location.href != evt.target.href ) {
                window.history.pushState(null, "", evt.target.href);
                router();
            }
        });
    });

    addFeedBtn.addEventListener("click", (evt) => showFeeds(evt));

    searchInput.addEventListener("input", (evt) => fillAutocomplete(evt));
}

async function init() {
    await openDB();
    addEventListeners();
    doPolling();
    await sidebarSites();
    initRouter();
    console.time("building index time");
    await buildIndex();
    console.timeEnd("building index time");
}

init();