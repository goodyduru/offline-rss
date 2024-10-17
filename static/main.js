function addEventListeners() {
    const pinBtn = document.querySelector('.pin');
    const closeBtn = document.querySelector('.close');
    const barsBtn = document.querySelector('.bars');
    const wrapper = document.querySelector('body > .wrapper');
    const links = document.querySelectorAll("aside a");

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
                app.appRouter.router();
            }
        });
    });
}

async function init() {
    await app.init();
    addEventListeners();
}

document.addEventListener("DOMContentLoaded", init, false);