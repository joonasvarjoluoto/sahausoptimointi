
function addCut() {

    const cutList = document.getElementById("cutList");

    const newRow = document.createElement("div");

    newRow.className = "cut-row";

    newRow.innerHTML = `
        <input class="cut-length" type="number" placeholder="Mitta">
        mm

        <input class="cut-quantity" type="number" value="1" placeholder="Kpl">
        kpl

        <button onclick="removeCut(this)">
            Poista
        </button>
    `;

    cutList.appendChild(newRow);
}


function removeCut(button) {

    const row = button.parentElement;

    row.remove();
}


function getCutsFromForm() {

    const lengthInputs =
        document.querySelectorAll(".cut-length");

    const quantityInputs =
        document.querySelectorAll(".cut-quantity");

    const cuts = [];

    for (let i = 0; i < lengthInputs.length; i++) {

        const length = Number(lengthInputs[i].value);
        const quantity = Number(quantityInputs[i].value);

        if (length > 0 && quantity > 0) {

            cuts.push({
                length: length,
                quantity: quantity
            });
        }
    }

    return cuts;
}


function cutPiece(remaining, piece, kerf) {

    const excess = remaining - piece;

    if (excess < 0) {

        return {
            possible: false,
            remaining: remaining,
            waste: 0
        };
    }

    if (excess >= kerf) {

        return {
            possible: true,
            remaining: excess - kerf,
            waste: kerf
        };
    }

    return {
        possible: true,
        remaining: 0,
        waste: excess
    };
}

function generateCombinations(pieces) {

    const combinations = [];

    function buildCombination(startIndex, currentCombination) {

        for (let i = startIndex; i < pieces.length; i++) {

            const newCombination =
                [...currentCombination, pieces[i]];

            combinations.push(newCombination);

            buildCombination(
                i + 1,
                newCombination
            );
        }
    }

    buildCombination(0, []);

    return combinations;
}

function evaluateCombination(combination, stockLength, kerf) {

    let remaining = stockLength;
    let waste = 0;

    for (const piece of combination) {

        const result =
            cutPiece(
                remaining,
                piece,
                kerf
            );

        if (!result.possible) {

            return {
                possible: false,
                remaining: remaining,
                waste: waste
            };
        }

        remaining = result.remaining;
        waste += result.waste;
    }

    return {
        possible: true,
        remaining: remaining,
        waste: waste
    };
}

function findBestCombination(pieces, stockLength, kerf) {

    const combinations = generateCombinations(pieces);

    let bestCombination = null;
    let bestResult = null;
    let bestIsUseful = false;

    for (const combination of combinations) {

        const result = evaluateCombination(
            combination,
            stockLength,
            kerf
        );

        // Ohitetaan yhdistelmät,
        // jotka eivät mahdu tankoon
        if (!result.possible) {
            continue;
        }

        // Onko jäännöspala käyttökelpoinen?
        const remnantEvaluation = evaluateRemnant(
            result.remaining,
            pieces,
            kerf
        );

        const isUseful = remnantEvaluation.piece !== null;

        // Ensimmäinen mahdollinen yhdistelmä
        if (bestCombination === null) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;

            continue;
        }

        // Käyttökelpoinen jäännös
        // voittaa käyttökelvottoman
        if (isUseful && !bestIsUseful) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;

            continue;
        }

        // Jos molemmat ovat joko
        // käyttökelpoisia tai käyttökelvottomia,
        // valitaan pienempi jäännös
        if (
            isUseful === bestIsUseful &&
            result.remaining < bestResult.remaining
        ) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;
        }
    }

    return {
        combination: bestCombination,
        result: bestResult
    };
}

function evaluateRemnant(remnant, pieces, kerf) {

    let bestRemaining = Infinity;
    let bestPiece = null;

    for (const piece of pieces) {

        const result =
            cutPiece(remnant, piece, kerf);

        if (!result.possible) {
            continue;
        }

        if (result.remaining < bestRemaining) {

            bestRemaining = result.remaining;
            bestPiece = piece;
        }
    }

    return {
        piece: bestPiece,
        remaining: bestRemaining
    };
}

function optimizeOrder(pieces, stockLength, kerf) {

    const remainingPieces = [...pieces];

    const bars = [];

    while (remainingPieces.length > 0) {

        const best = findBestCombination(
            remainingPieces,
            stockLength,
            kerf
        );

        // Jos sopivaa yhdistelmää ei löydy,
        // lopetetaan
        if (best.combination === null) {
            break;
        }

        // Luodaan uusi tanko
        bars.push({
            cuts: best.combination,
            remaining: best.result.remaining,
            waste: best.result.waste
        });

        // Poistetaan käytetyt kappaleet
        for (const piece of best.combination) {

            const index =
                remainingPieces.indexOf(piece);

            if (index !== -1) {
                remainingPieces.splice(index, 1);
            }
        }
    }

    return bars;
}


function optimizeCuts(cuts, stockLength, kerf) {

    // Muutetaan kappalemäärät yksittäisiksi kappaleiksi
    const pieces = [];

    for (const cut of cuts) {

        for (let i = 0; i < cut.quantity; i++) {

            pieces.push(cut.length);
        }
    }


    // Järjestetään pisimmästä lyhimpään
    pieces.sort((a, b) => b - a);


    const bars = [];


    // Käydään kaikki kappaleet läpi
    for (const piece of pieces) {

        let placed = false;


        // Etsitään paras olemassa oleva tanko
        let bestBar = null;
        let bestRemaining = Infinity;
        let bestIsUseful = false;


        for (const bar of bars) {

            if (bar.remaining >= piece) {

                const result =
                    cutPiece(
                        bar.remaining,
                        piece,
                        kerf
                    );


                // Onko jäännöspala käyttökelpoinen?
                const isUseful =
                    result.remaining >= 1000;


                // Ensimmäinen sopiva tanko
                if (bestBar === null) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;


                    // Käyttökelpoinen jäännös voittaa
                } else if (
                    isUseful && !bestIsUseful
                ) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;


                    // Jos käyttökelpoisuus on sama,
                    // valitaan lyhyempi jäännös
                } else if (
                    isUseful === bestIsUseful &&
                    result.remaining < bestRemaining
                ) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;
                }
            }
        }


        // Jos sopiva tanko löytyi
        if (bestBar !== null) {

            const result =
                cutPiece(
                    bestBar.remaining,
                    piece,
                    kerf
                );


            bestBar.cuts.push(piece);

            bestBar.remaining =
                result.remaining;

            bestBar.waste +=
                result.waste;

            placed = true;
        }


        // Jos kappale ei mahtunut mihinkään,
        // aloitetaan uusi tanko
        if (!placed) {

            const result =
                cutPiece(
                    stockLength,
                    piece,
                    kerf
                );


            bars.push({

                cuts: [piece],

                used: piece,

                remaining: result.remaining,

                waste: result.waste
            });
        }
    }


    return bars;
}


function calculate() {

    const stockLength =
        Number(
            document.getElementById("stockLength").value
        );


    const kerf =
        Number(
            document.getElementById("kerf").value
        );


    const cuts =
        getCutsFromForm();


    const bars =
        optimizeCuts(
            cuts,
            stockLength,
            kerf
        );


    let result = "";


    result +=
        "Tankoja tarvitaan: " +
        bars.length +
        "<br><br>";


    for (let i = 0; i < bars.length; i++) {

        const bar = bars[i];


        result +=
            "<strong>TANKO " +
            (i + 1) +
            "</strong><br>";


        result +=
            bar.cuts.join(" + ");


        result +=
            " | Jäännös: " +
            bar.remaining +
            " mm";


        result +=
            " | Sahahukka: " +
            bar.waste +
            " mm";


        result += "<br><br>";
    }


    document.getElementById("result").innerHTML =
        result;
}

console.log(
    evaluateRemnant(
        1997,
        [1800, 1500, 1000],
        3
    )
);

console.log(
    evaluateRemnant(
        2497,
        [1800, 1500, 1000],
        3
    )
);

console.log(
    findBestCombination(
        [4000, 1000, 3000, 2000],
        6000,
        3
    )
);