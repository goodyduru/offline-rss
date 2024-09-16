package main

import (
	"io"
	"log"
	"net/http"
	"net/url"
)

func requestRSS(w http.ResponseWriter, r *http.Request) {
	site, p := r.Header["Rss-Url"]
	if !p {
		http.Error(w, "bad URL", http.StatusBadRequest)
		return
	}

	if _, err := url.ParseRequestURI(site[0]); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	req, err := http.NewRequest("GET", site[0], nil)
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

func main() {
	http.Handle("/", http.FileServer(http.Dir("./static")))
	http.HandleFunc("/proxy", requestRSS)
	log.Fatal(http.ListenAndServe(":5000", nil))
}
