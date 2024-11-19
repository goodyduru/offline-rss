app.models.Search = class Search extends app.Model {
    constructor() {
        super();
        this.radix = new Radix();
        this.countMap = new CountMap();
        /**
        * Stopwords gotten from lucene. A union of (https://github.com/apache/lucene/blob/5d5dddd10328a6131c5bd06c88fef4034971a8e9/lucene/analysis/common/src/java/org/apache/lucene/analysis/en/EnglishAnalyzer.java#L47) and (https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/resources/org/apache/lucene/analysis/cjk/stopwords.txt).
        */
        this.stopWords = ["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is",
            "it", "no", "not", "of", "on", "or", "s", "such", "t", "that", "the", "their", "then", "there",
            "these", "they", "this", "to", "was", "will", "with", "www"];
    }

    /**
     * Add an article's title and content to the radix index. This function splits the sentences into individual words
     * and removes all the symbols and spaces. The result that isn't in the stopwords are then added to the radix tree.
     * @param {Object} article article to add to the index.
     */
    add(article) {
        let titleArray = article.title.toLowerCase().split(" ");
        let count = 0;
        for ( let title of titleArray ) {
            if ( this.stopWords.includes(title) ) {
                continue;
            }
            let ts = title.split("-");
            for ( let t of ts ) {
                t = t.replace(/\W/g, '');
                if ( t != title && this.stopWords.includes(t) ) {
                    continue;
                }
                if ( t != "" ) {
                    this.radix.insert(t, article.id, true);
                    count++;
                }
            }
        }

        // Convert html to text.
        let template = document.createElement("template");
        template.innerHTML = article.content;
        let articleContent = template.content.textContent || template.content.innerText || "";
    
        let contentArray = articleContent.toLowerCase().split(" ");
        for ( let content of contentArray ) {
            if ( this.stopWords.includes(content) ) {
                continue;
            }
            let cs = content.split("-");
            for ( let c of cs ) {
                c = c.replace(/\W/g, '');
                if ( c != content && this.stopWords.includes(c) ) {
                    continue;
                }
                if ( c != "" ) {
                    this.radix.insert(c, article.id, false);
                    count++;
                }
            }
        }
        this.countMap.add(article.id, count);
    }

    /**
     * Searches for the sentence in the search index. The sentence is splitted into words and each word is sought for in the index.
     * @param {String} words The sentence to search for.
     * @returns {Array} A list of the article ids that contains the words.
     */
    async get(words) {
        words = words.toLowerCase();
        let wordArray = words.trim().split(" ");
        let numArticles = await app.articleModel.count();
        let results = {};
        let end = wordArray.length - 1;
        for ( let i = 0; i < wordArray.length; i++ ) {
            let w = wordArray[i].trim();
            if ( w == "" ) {
                continue;
            }
            let res = this.radix.startsWith(w, i != end);
            if ( res == null ) {
                continue;
            }
            let temp = {};
            for ( let p of res ) {
                // Give title twice the weights of content.
                if ( temp[p.id] ) {
                    temp[p.id] += p.bodyPopulation;
                    temp[p.id] += (2 * p.titlePopulation);
                } else {
                    temp[p.id] = 2 * p.titlePopulation + p.bodyPopulation;
                }
            }
            let idf = Math.log10(numArticles / Object.keys(temp).length);
            for ( const [key, value] of Object.entries(temp) ) {
                let tf = value / this.countMap.get(key);
                let tfidf = tf * idf;
                if ( results[key] ) {
                    results[key] += tfidf;
                } else {
                    results[key] = tfidf;
                }
            }
        }
        let entries = Object.entries(results);
        entries.sort((a, b) => b[1] - a[1]);
        return entries.map((val) => parseInt(val[0]));
    }

    /**
     * Creates the index of all the articles in the db.
     */
    async create() {
        let loaded = await this.load();
        if ( loaded ) {
            return;
        }
        let sites = await app.siteModel.getAll();
        for ( let site of sites ) {
            let done = false;
            let offset = 0;
            while ( !done ) {
                let articles = await app.articleModel.getInSite(site.id, null, offset);
                if ( articles == null || articles.length < this.per_page ) {
                    done = true;
                }
                offset += articles.length;
                for ( let article of articles ) {
                    this.add(article);
                }
            }
        }
        this.save();
    }

    /**
     * Delete articles from the index using their ids.
     * @param {Array} ids Article ids to delete
     */
    delete(ids) {
        for ( let id of ids ) {
            this.radix.delete(id);
            this.countMap.delete(id);
        }
        this.save();
    }

    save() {
        let index = this.radix.serialize();
        index.id = 1;
        const store = app.db.getSearchStore('readwrite');
        super.update(store, index);
        let countIndex = this.countMap.serialize();
        countIndex.id = 2;
        super.update(store, countIndex);
    }

    async load() {
        const store = app.db.getSearchStore('readonly');
        let index = await super.get(store, 'id', 1);
        if ( index == null ) {
            return false;
        }
        this.radix.unserialize(index);
        index = await super.get(store, 'id', 2);
        if ( index != null ) {
            this.countMap.unserialize(index);
            return true;
        }
        return false;
    }
};