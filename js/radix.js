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

    startsWith(prefix, exact) {
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

            if ( x == substr.length && y < node_key.length && !exact ) {
                node = node.children[index];
                break;
            }

            return null;
        }
        if ( exact ) {
            return node.postings;
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
    
    #_serialize(node, result) {
        let key_id = result.keys.length;
        result.keys.push(node.key);
        if ( node.postings != null ) {
            result.postings.push([]);
            for ( let posting of node.postings ) {
                result.postings[key_id].push(posting.id, posting.titlePopulation, posting.bodyPopulation);
            }
        } else {
            result.postings.push(0);
        }
        if ( node.children != null ) {
            result.children.push([]);
            for ( let child of node.children ) {
                let id = this.#_serialize(child, result);
                result.children[key_id].push(id);
            }
        } else {
            result.children.push(0);
        }
        /**
         * return {
         *  keys: [],
         *  postings = [[], []]
         *  children = [[], []]
         * }
         */
        return key_id;
    }

    serialize() {
        let result = {keys: [], postings: [], children: []};
        this.#_serialize(this.root, result);
        return result;
    }

    #_unserialize(obj, node, key_id) {
        if ( obj.postings[key_id] != 0 ) {
            let postings = obj.postings[key_id];
            node.postings = [];
            for ( let i = 0; i < postings.length; i += 3) {
                let p = new Posting(postings[i], 0);
                p.titlePopulation = postings[i+1];
                p.bodyPopulation = postings[i+2];
                node.postings.push(p);
            }
        }

        if ( obj.children[key_id] != 0 ) {
            let children = obj.children[key_id];
            node.children = [];
            for ( let child_id of children ) {
                let c = new RadixNode(obj.keys[child_id]);
                this.#_unserialize(obj, c, child_id);
                node.children.push(c);
            }
        }
    }

    unserialize(obj) {
        this.#_unserialize(obj, this.root, 0);
    }
}