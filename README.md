# IntelX
Level Up is a retro pixel-art web game for walk-in shoppers at Croma, Reliance Digital and Vijay Sales. Players start on a "normal" PC and unlock AI PC upgrades as they play. Each upgrade visibly improves the game. A quick quiz then recommends the right Intel Core Ultra processor and shows how it beats the competition.

## Run locally
You can double-click `index.html`, or serve it locally:

```
python3 -m http.server 8000
# open http://localhost:8000
```

Jump straight to any screen while testing: `http://localhost:8000/#quiz` (also `#select`, `#tutorial`, `#game`, `#gameover`, `#placeholder`, `#rec`, `#compare`, `#end`).

Game stages can be opened directly too: `#game&stage=1` (60 fps), `#game&stage=2` (AI Upscaling), `#game&stage=2&jam` (traffic + lag), `#game&stage=3` (neon/bloom).

## Swapping processor data
All processor names, specs, images and comparison rows live in `js/processors.js`.

## Deploy
Push to GitHub and enable Pages (Settings → Pages → deploy from branch `master`, root folder).
