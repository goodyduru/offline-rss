#!/bin/bash
cd static || exit
oldOutputFile=""
oldOutputFile=$(ls output-*)

inputFiles=("parser.js" "feedfinder.js" "radix.js" "app.js" "db.js" "model.js" "models" "controller.js" "controllers" "view.js" "views" "router.js" "poll.js")
end=$(( ${#inputFiles[@]}-1 )) # Get length of array

timestamp=$(date "+%Y%m%d-%H%M%S")
outputFile="output-$timestamp.js"
touch "$outputFile"

for i in "${!inputFiles[@]}";do
    filePath="../js/${inputFiles[$i]}"
    if [ -f "$filePath" ]; then
        cat "$filePath" >> "$outputFile"
        if [ "$i" -lt $end ]; then
            printf "\n\n" >> "$outputFile"
        fi
    else
        # A directory, get all the files in it and append it to the output file
        arr=("$filePath"/*)
        for f in "${arr[@]}"; do
            cat "$f" >> "$outputFile"
            printf "\n\n" >> "$outputFile"
        done
    fi
done

if [ "$oldOutputFile" != "" ]; then
    diffOutput=$(diff -q "$oldOutputFile" "$outputFile")
    if [ "$diffOutput" == "" ];then
        # No difference between new and old file, remove new file.
        rm "$outputFile"
        exit
    else
        rm "$oldOutputFile"
    fi
fi
sed -i'.bak' -e "s/$oldOutputFile/$outputFile/" index.html
sed -i'.bak' -e "s/$oldOutputFile/$outputFile/" sw.js
rm index.html.bak sw.js.bak # Remove backup files that were created