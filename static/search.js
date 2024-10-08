/**
 * Stopwords gotten from lucene. A union of (https://github.com/apache/lucene/blob/5d5dddd10328a6131c5bd06c88fef4034971a8e9/lucene/analysis/common/src/java/org/apache/lucene/analysis/en/EnglishAnalyzer.java#L47) and (https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/resources/org/apache/lucene/analysis/cjk/stopwords.txt).
 */
const stopWords = ["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is",
            "it", "no", "not", "of", "on", "or", "s", "such", "t", "that", "the", "their", "then", "there",
            "these", "they", "this", "to", "was", "will", "with", "www"];

const INDEX_NAME = "index";

class Posting {
    constructor(id, isTitle) {
        this.id = id;
        this.titlePopulation = 0;
        this.bodyPopulation = 0;
        if ( isTitle ) {
            this.titlePopulation++;
        } else {
            this.bodyPopulation++;
        }
    }

    addTitle() {
        this.titlePopulation++;
    }

    addBody() {
        this.bodyPopulation++;
    }
}

class TrieNode {
    constructor() {
        this.children = {};
        this.postings = null;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word, articleId, isTitle) {
        let node = this.root;
        for ( let i = 0; i < word.length; i++ ) {
            let char = word[i];
            if ( !node.children[char] ) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        if ( node.postings == null ) {
            let post = new Posting(articleId, isTitle);
            node.postings = [post];
        } else {
            let index = node.postings.findIndex((posting) => {posting.id == articleId});
            if ( index > -1 ) {
                if ( isTitle ) {
                    node.postings[index].addTitle();
                } else {
                    node.postings[index].addBody();
                }
            } else {
                let post = new Posting(articleId, isTitle);
                node.postings.push(post);
            }  
        }
    }

    delete(articleId, node) {
        if ( node === undefined || node == null ) {
            node = this.root;
        }
        for ( let child in node.children ) {
            this.delete(articleId, node.children[child]);
            if ( Object.keys(node.children[child].children).length == 0 && node.children[child].postings == null ) {
                delete node.children[child];
            }
        }
        if ( node.postings == null ) {
            return;
        }
        let index = node.postings.findIndex((posting) => posting.id == articleId);
        if ( index > -1 ) {
            if ( node.postings.length > 1 ) {
                node.postings[index] = node.postings[node.postings.length-1];
                node.postings.pop();
            } else {
                node.postings = null;
            }
        }
    }

    startsWith(prefix) {
        let postings = [];
        let node = this.root;
        let found = true;
        for (let i = 0; i < prefix.length; i++ ) {
            let char = prefix[i];
            if ( !node.children[char] ) {
                found = false;
                break;
            }
            node = node.children[char];
        }
        if ( !found ) {
            return null;
        }

        let stack = [node];
        while ( stack.length > 0 ) {
            let node = stack.pop();
            for ( let child in node.children ) {
                stack.push(node.children[child]);
            }
            if ( node.postings != null ) {
                postings.push(...node.postings);
            }
        }
        return postings;
    }
}

const trie = new Trie();
function addToIndex(article) {
    let titleArray = article.title.toLowerCase().split(" ");
    for ( let title of titleArray ) {
        if ( stopWords.includes(title) ) {
            continue;
        }
        let ts = title.split("-");
        for ( let t of ts ) {
            t = t.replace(/\W/g, '');
            if ( t != title && stopWords.includes(t) ) {
                continue;
            }
            if ( t != "" ) {
                trie.insert(t, article.id, true);
            }
        }
    }
    let template = document.createElement("div");
    template.innerHTML = article.content;
    let articleContent = template.textContent || template.innerText || "";

    let contentArray = articleContent.toLowerCase().split(" ");
    for ( let content of contentArray ) {
        if ( stopWords.includes(content) ) {
            continue;
        }
        let cs = content.split("-");
        for ( let c of cs ) {
            c = c.replace(/\W/g, '');
            if ( c != content && stopWords.includes(c) ) {
                continue;
            }
            if ( c != "" ) {
                trie.insert(c, article.id, false);
            }
        }
    }
}

function search(words) {
    words = words.toLowerCase();
    let wordArray = words.trim().split(" ");
    let results = {};
    for ( let word of wordArray ) {
        let w = word.trim();
        if ( word == "" ) {
            continue;
        }
        let res = trie.startsWith(w);
        if ( res == null ) {
            continue;
        }
        for ( let p of res ) {
            if ( results[p.id] ) {
                results[p.id] += p.bodyPopulation;
                results[p.id] += (2 * p.titlePopulation);
            } else {
                results[p.id] = 2 * p.titlePopulation + p.bodyPopulation;
            }
        }
    }
    let entries = Object.entries(results);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.map((val) => parseInt(val[0]));
}

async function buildIndex() {
    let sites = await getAllSites();
    for ( let site of sites ) {
        let done = false;
        let offset = 0;
        while ( !done ) {
            let articles = await getSiteArticles(site.id, null, offset);
            if ( articles == null || articles.length < PER_PAGE ) {
                done = true;
            }
            offset += articles.length;
            for ( article of articles ) {
                addToIndex(article);
            }
        }
    }
}

function test() {
    // search for article titles that start with the user's query
    const userInput = "go";
    let result = search(userInput);
    console.log(result);
}
//r = Object.assign(new Trie, r);