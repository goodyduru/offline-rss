package main

import (
	"io"
	"log"
	"net/http"
	"net/url"
)

func requestRSS(w http.ResponseWriter, r *http.Request) {
	queryUrl := r.URL.Query().Get("u")
	if queryUrl == "" {
		http.Error(w, "bad URL", http.StatusBadRequest)
		return
	}

	if _, err := url.ParseRequestURI(queryUrl); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	req, err := http.NewRequest("GET", queryUrl, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for k, v := range r.Header {
		for i := range v {
			req.Header.Add(k, v[i])
		}
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	for k, v := range resp.Header {
		for i := range v {
			w.Header().Add(k, v[i])
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func loadIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/index.html")
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServer(http.Dir("./static")))
	mux.HandleFunc("GET /feed-list", loadIndex)
	mux.HandleFunc("GET /add-feed", loadIndex)
	mux.HandleFunc("GET /feed/{id}", loadIndex)
	mux.HandleFunc("GET /article/{id}", loadIndex)
	mux.HandleFunc("GET /proxy", requestRSS)
	log.Fatal(http.ListenAndServe(":5000", mux))
}
