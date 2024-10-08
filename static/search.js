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

class RadixNode {
    constructor(key) {
        this.key = key;
        this.children = null;
        this.postings = null;
    }
}

class Radix {
    constructor() {
        this.root = new RadixNode(null);
    }

    searchChildren(word, children) {
        let low = 0;
        let high = children.length - 1;
        let char = word[0];
        while ( low <= high ) {
            let mid = Math.floor((low + high)/2);
            let other = children[mid].key[0];
            if ( char > other ) {
                low = mid + 1;
            } else if ( char < other ) {
                high = mid - 1;
            } else {
                return mid;
            }
        }
        return -1;
    }

    rearrange(children, index, isForward) {
        if ( isForward ) {
            while ( index < children.length - 1 ) {
                let temp = children[index];
                children[index] = children[index+1];
                children[index+1] = temp;
                index++;
            }
        } else {
            while ( index > 0 && children[index-1].key > children[index].key ) {
                let temp = children[index];
                children[index] = children[index-1];
                children[index-1] = temp;
                index--;
            }
        }
    }

    insert(word, articleId, isTitle) {
        let node = this.root;
        let i = 0;
        while ( i < word.length ) {
            let substr = word.substring(i);
            if ( node.children == null ) {
                node.children = [substr];
                node.children[0] = new RadixNode(substr);
                node = node.children[0];
                break;
            }
            let index = this.searchChildren(substr, node.children);
            if ( index == -1 ) {
                let child = new RadixNode(substr);
                node.children.push(child);
                this.rearrange(node.children, node.children.length-1, false);
                node = child;
                break;
            }
            let node_key = node.children[index].key;

            if ( node_key == substr ) {
                node = node.children[index];
                break;
            }

            let x = 0;
            let y = 0;
            while ( x < substr.length && y < node_key.length ) {
                if ( substr[x] != node_key[y] ) {
                    break;
                }
                x++;
                y++;
            }

            // key = java, word = javascript
            if ( y == node_key.length && x < substr.length ) {
                i += x;
                node = node.children[index];
                continue;
            }

            // key = javascript, word = java
            if ( x == substr.length && y < node_key.length ) {
                let new_key = node_key.substring(y);
                node.children[index].key = substr;
                let new_node = new RadixNode(new_key);
                new_node.postings = node.children[index].postings;
                new_node.children = node.children[index].children;
                node.children[index].children = [new_node];
                node.children[index].postings = null;
                node = node.children[index];
                break;
            }

            // key = jug, word = java
            let new_key = node_key.substring(0, y);
            let new_child_key = node_key.substring(y);
            node.children[index].key = new_key;
            let new_node = new RadixNode(new_child_key);
            new_node.postings = node.children[index].postings;
            new_node.children = node.children[index].children;
            node.children[index].children = [new_node];
            node.children[index].postings = null;
            node = node.children[index];
            i += x;
        }
        if ( node.postings == null ) {
            let post = new Posting(articleId, isTitle);
            node.postings = [post];
        } else {
            let index = node.postings.findIndex((posting) => posting.id == articleId);
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
        if ( node.children == null && node.postings == null ) {
            return;
        }
        if ( node.children != null ) {
            let i = 0;
            let length = node.children.length;

            while ( i < length ) {
                this.delete(articleId, node.children[i]);
                if ( node.children[i].children == null && node.children[i].postings == null ) {
                    if ( length > 1 ) {
                        this.rearrange(node.children, i, true);
                        node.children.pop();
                    }
                    length--;
                    continue;
                }
                i++;
            }
            if ( length == 0 ) {
                node.children = null;
            }
        }
        if ( node.postings != null ) {
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
        if ( node != this.root && node.children != null && node.children.length == 1 && node.postings == null ) {
            let child = node.children[0];
            node.postings = child.postings;
            node.children = child.children;
            node.key = node.key + child.key;
        }
    }

    startsWith(prefix) {
        let postings = [];
        let node = this.root;
        let i = 0;
        while ( i < prefix.length ) {
            if ( node.children == null ) {
                return null;
            }
            let substr = prefix.substring(i);
            let index = this.searchChildren(substr, node.children);
            if ( index == -1 ) {
                return null;
            }
            let node_key = node.children[index].key;

            if ( node_key == substr ) {
                node = node.children[index];
                break;
            }

            let x = 0;
            let y = 0;
            while ( x < substr.length && y < node_key.length ) {
                if ( substr[x] != node_key[y] ) {
                    break;
                }
                x++;
                y++;
            }
            if ( y == node_key.length && x < substr.length ) {
                node = node.children[index];
                i += x;
                continue;
            }

            if ( x == substr.length && y < node_key.length ) {
                node = node.children[index];
                break;
            }

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

const radix = new Radix();

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
                radix.insert(t, article.id, true);
            }
        }
    }
    let template = document.createElement("template");
    template.innerHTML = article.content;
    let articleContent = template.content.textContent || template.content.innerText || "";

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
                radix.insert(c, article.id, false);
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
        let res = radix.startsWith(w);
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

function deleteFromIndex(ids) {
    for ( id of ids ) {
        radix.delete(id);
    }
}