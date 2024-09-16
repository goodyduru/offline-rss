const ARTICLE_LIST_HREF = "#article-list"

function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            showOneMain(evt.target.href);
        });
    });

    document.getElementById("add-feed-btn").addEventListener("click", (evt) => addFeed(evt));
}

function showOneMain(href) {
    const index = href.indexOf("#");
    if ( index == -1 ) {
        return;
    } 
    const id = href.substring(index+1);
    if ( id == "" ) {
        return;
    }
    document.querySelectorAll("main").forEach((content) => {
        if (content.getAttribute("id") == id) {
            content.classList.remove("d-none");
            return;
        }
        content.classList.add("d-none");
    });
}

function showUrlMain() {
    const loc = document.location;
    showOneMain(loc.hash);
}

async function addFeed(evt) {
    const response = await fetchFeed(evt);
    const text = await response.text();
    let type = "text/html";
    const content_type = response.headers.get("Content-Type");
    if ( content_type.indexOf("text/xml") > -1 || content_type.indexOf("application/xml") > -1 ) {
        type = "text/xml";
    }
    const dom = new window.DOMParser().parseFromString(text, type);
    let feed = dom.querySelector("rss");
    if (feed != null) {
        parseRSS(dom);
        return;
    }
    feed = dom.querySelector("feed");
    if ( feed != null ) {
        parseAtom(dom);
    }
}

async function fetchFeed(evt) {
    evt.preventDefault();
    let url = document.getElementById("feed-url").value;
    if ( !URL.canParse(url) ) {
        alert("Invalid url");
        return;
    }
    
    const response = await fetch("/proxy", {
        headers: {
            "Rss-Url": url,
        }
    });

    if (!response.ok) {
        alert("Fetcher error!");
        return;
    }
    return response;
}

function parseRSS(dom) {
    let title = dom.querySelector("channel>title");
    let link = dom.querySelector("channel>link");
    let description = dom.querySelector("channel>description");
    let result = {title: "", feed_link: "", site_link: "", description: "", entries: []};
    result.title = ( title != null ) ? title.innerHTML : "";
    result.feed_link = ( link != null ) ? link.innerHTML : "";
    result.description = ( description != null ) ? description.innerHTML : "";
    let items = dom.querySelectorAll("item");
    items.forEach(item => {
        entry = {title: "", link: "", content: "", pubDate: ""};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let description = item.querySelector("description");
        let pubDate = item.querySelector("pubDate");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.innerHTML : "";
        entry.content = ( description != null ) ? description.innerHTML : "";
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        result.entries.push(entry);
    });
    printFeed(result);
}

function parseAtom(dom) {
    let title = dom.querySelector("feed>title");
    let links = dom.querySelectorAll("feed>link");
    let result = {title: "", feed_link: "", site_link: "", description: "", entries: []};
    result.title = ( title != null ) ? title.innerHTML : "";
    if ( links.length == 1 ) {
        result.feed_link = links[0].getAttribute("href");
    } else {
        links.forEach((link) => {
            if ( link.getAttribute("rel") == "self" ) {
                result.feed_link = link.getAttribute("href");
            } else {
                result.site_link = link.getAttribute("href");
            }
        })
    }
    let items = dom.querySelectorAll("entry");
    items.forEach(item => {
        entry = {title: "", link: "", description: "", pubDate: ""};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let content = item.querySelector("content");
        let pubDate = item.querySelector("published");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.getAttribute("href") : "";
        entry.content = ( content != null ) ? content.innerHTML : "";
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        result.entries.push(entry);
    });
    printFeed(result);
}

function printFeed(feed) {
    let html = ``;
    if ( feed.title != "" ) {
        html += `<h2>${feed.title}</h2>`;
    }

    if ( feed.site_link != "" ) {
        html += `<p>Visit the site link: <a href="${feed.site_link}">${feed.site_link}</a></p>`;
    }
    if ( feed.description != "" ) {
        html += `<div>${feed.description}</div>`;
    }
    if ( feed.entries.length > 0 ) {
        html += "<ul>";
    }
    feed.entries.forEach((entry) => {
        html += "<li>";
        if ( entry.title != "" ) {
            html += `<h4>${entry.title}</h4>`;
        }
        if ( entry.link != "" ) {
            html += `<p>Visit the article link: <a href="${entry.link}">${entry.link}</a></p>`;
        }
        if ( entry.content != "" ) {
            html += `<div>${entry.content}</div>`;
        }
        if ( entry.pubDate != "" ) {
            html += `<p>Published on: ${entry.pubDate}</p>`;
        }
        html += "</li>";
    });
    html += "</ul>";
    const article_list = document.querySelector(ARTICLE_LIST_HREF);
    article_list.replaceChildren();
    article_list.insertAdjacentHTML("beforeend", html);
    showOneMain(ARTICLE_LIST_HREF);
}

showUrlMain();
addEventListeners();