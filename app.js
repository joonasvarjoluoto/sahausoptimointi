function addCut() {

    const cutList = document.getElementById("cutList");

    const newRow = document.createElement("div");

    newRow.className = "cut-row";

    newRow.innerHTML = `
        <input class="cut-length" type="number" placeholder="Mitta">
        mm

        <input class="cut-quantity" type="number" placeholder="Kpl">
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

        // Yritetään sijoittaa kappale johonkin olemassa olevaan tankoon
        for (const bar of bars) {

            if (bar.remaining >= piece + kerf) {

                bar.cuts.push(piece);
                bar.remaining -= piece + kerf;

                placed = true;

                break;
            }
        }

        // Jos kappale ei mahtunut mihinkään,
        // aloitetaan uusi tanko
        if (!placed) {

            bars.push({
                cuts: [piece],
                remaining: stockLength - piece
            });
        }
    }

    return bars;
}

function calculate() {

    const stockLength =
        Number(document.getElementById("stockLength").value);

    const kerf =
        Number(document.getElementById("kerf").value);
    
    const cuts = getCutsFromForm();

    const bars = optimizeCuts(cuts, stockLength, kerf);

    let result = "";

    result += "Tankoja tarvitaan: " + bars.length + "<br><br>";

    for (let i = 0; i < bars.length; i++) {

        const bar = bars[i];

        result += "<strong>TANKO " + (i + 1) + "</strong><br>";

        result += bar.cuts.join(" + ");

        result +=
            " = " +
            (stockLength - bar.remaining) +
            " mm";

        result +=
            " | Hukka: " +
            bar.remaining +
            " mm";

        result += "<br><br>";
    }

    document.getElementById("result").innerHTML = result;
}

