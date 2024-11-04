/**
 * This is a class that maps an article content to its total length
 */
class CountMap {
    constructor() {
        this.map = {};
    }

    add(articleId, length) {
        this.map[articleId] = length;
    }

    delete(articleId) {
        delete this.map[articleId];
    }

    get(articleId) {
        return this.map[articleId];
    }

    serialize() {
        return this.map;
    }

    unserialize(obj) {
       this.map = obj;
    }
}