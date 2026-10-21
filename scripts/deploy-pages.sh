#!/bin/sh
# Publish dist/ to the gh-pages branch (GitHub Pages serves it from there).
set -e
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
cd dist
touch .nojekyll
cp index.html 404.html
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy OpenCode to GitHub Pages"
# Large bundles (3D libraries, speech engine) need a bigger HTTP buffer than git’s default.
git -c http.postBuffer=524288000 -c http.version=HTTP/1.1 push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Deployed to gh-pages."
