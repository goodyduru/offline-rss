app.views.Search = class SearchView {
    constructor() {
        this.searchInput = document.getElementById("query");
        this.autocomplete = document.getElementById("autocomplete");
        this.closeOnClickOutside(this.autocomplete);
    }

    closeOnClickOutside() {
        let ele = this.autocomplete;
        document.addEventListener('click', event => {
            if (!ele.contains(event.target) && ele.style.display == 'block') {
                ele.style.display = 'none';
            }
        });
    }

    closeBox() {
        this.autocomplete.style.display = "none";
    }

    bindInputChange(handleInputText) {
        this.searchInput.addEventListener("input", async (evt) => {
            const text = evt.target.value.trim();
            if ( text == "" ) {
                this.closeBox();
                return;
            }
            let resultStrings = await handleInputText(text);
            if ( resultStrings.length == 0 ) {
                return;
            }
            let resultHtml = `<ul>${resultStrings.join("")}</ul>`;
            this.autocomplete.innerHTML = resultHtml;
            this.autocomplete.style.display = "block";
            this.autocomplete.scrollTo(0, 0);
        });
    }
};