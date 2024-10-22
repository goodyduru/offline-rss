app.views.ListFeeds = class ListFeedsView extends app.PageView {
    constructor() {
        super();
        this.id = "feed-list";
        this.title = "All Feeds"
        this.parent = document.getElementById(this.id);
        this.editForm = document.getElementById("rename-form");
        this.deleteForm = document.getElementById("delete-form");
    }

    setSiteFunctions(editSiteFunc, deleteSiteFunc) {
        this.editSiteFunc = editSiteFunc;
        this.deleteSiteFunc = deleteSiteFunc;
    }

    async editAction(site, table_row, controller) {
        let formParent = this.editForm.parentNode;
        site.title = this.editForm.querySelector('input').value;
        await this.editSiteFunc(site);
        table_row.firstChild.textContent = site.title;
        this.editForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    };

    cancelAction(controller, previousStatement) {
        let form;
        if ( typeof this.previousStatement != "undefined" ) {
            form = this.deleteForm;
            form.querySelector('p').textContent = previousStatement;
        } else {
            form = this.editForm
        }
        let formParent = form.parentNode;
        form.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    editSite(site, table_row) {
        const formParent = this.editForm.parentNode;
        const controller = new AbortController();
        const signal = controller.signal;
        this.editForm.querySelector('input').value = site.title;
        this.editForm.querySelectorAll('span')[1].textContent = site.feedUrl;
        this.editForm.classList.remove("d-none");
        const btns = this.editForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.editAction(site, table_row, controller);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller);
        }, {once: true});
        formParent.style.display = "flex";
    }

    async deleteAction(site, table_row, controller, previousStatement) {
        await this.deleteSiteFunc(site);
        let formParent = this.deleteForm.parentNode;
        let tbody = table_row.parentNode;
        tbody.removeChild(table_row);
        if ( tbody.childNodes.length == 0 ) {
            let feedListSection = tbody.parentNode.parentNode;
            feedListSection.replaceChildren();
            feedListSection.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
        }
        this.deleteForm.querySelector('p').textContent = previousStatement;
        this.deleteForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    deleteSite(site, table_row) {
        const parent = this.deleteForm.parentNode;
        let textView = this.deleteForm.querySelector('p');
        let previousStatement = textView.textContent;
        const controller = new AbortController();
        const signal = controller.signal;
        textView.textContent = `Are you sure you want to delete ${site.title} and all its articles?`;
        this.deleteForm.classList.remove("d-none");
        const btns = this.deleteForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteAction(site, table_row, controller, previousStatement);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller, previousStatement);
        }, {once: true});
        parent.style.display = "flex";
    }
    
    render(sites) {
        super.render();
        this.parent.replaceChildren();
        if ( sites.length == 0 ) {
            const message = "<p>You've not subscribed to any feed.</p>";
            parent.insertAdjacentHTML("beforeend", message);
            return;
        }
        const table = this.htmlToNode("<table><thead><tr><th scope='col'>Feed Name</th><th></th><th></th></tr></thead><tbody></tbody></table>");
        const body = table.lastChild;
        for ( let site of sites ) {
            let html = `<tr><td>${site.title}</td><td><a href="#" class="btn">Rename</a></td><td><a href="#" class="btn btn-danger">Delete</a></td></tr>`;
            let row = this.htmlToNode(html);
            row.children[1].firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.editSite(site, row);
            });
            row.lastChild.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.deleteSite(site, row)
            });
            body.append(row);
        }
        this.parent.append(table);
        super.show();
    }
};