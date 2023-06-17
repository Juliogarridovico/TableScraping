import clipboardy from "clipboardy";
import cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import url from "url";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
let previousClipboardData = "";

setInterval(async () => {
  const clipboardData = clipboardy.readSync();

  if (clipboardData !== previousClipboardData) {
    console.log("El portapapeles ha sido modificado.");
    previousClipboardData = clipboardData;

    const $ = cheerio.load(clipboardData);
    const table = $("table");

    if (table.length > 0) {
      const jsonData = [];
      let headers = [];

      table.find("tr").each((rowIndex, row) => {
        if (rowIndex === 0) {
          $(row)
            .find("th")
            .each((headerIndex, header) => {
              headers.push($(header).text().trim());
            });
        } else {
          const rowData = {};

          $(row)
            .find("td")
            .each((cellIndex, cell) => {
              const imgSrc = $(cell).find("img").attr("src");
              let titleValue; // Define titleValue aquí
              const titleValueRaw = $(cell).find("img").attr("title");

              if (titleValueRaw) {
                titleValue = titleValueRaw.replace(/[^-\d]/g, "");
              } else {
                console.log(
                  "El atributo title no está definido para esta imagen"
                );
              }
              if (imgSrc) {
                const imageName = path.basename(url.parse(imgSrc).pathname); // Usa el nombre de la imagen original
                const imagePath = path.join("imagenes", imageName);
                const relativePath = `./imagenes/${imageName}`; // Ruta relativa
                if (!fs.existsSync(imagePath)) {
                  // Verifica si la imagen ya existe.
                  if (imgSrc) {
                    const parsedUrl = url.parse(imgSrc);
                    if (
                      parsedUrl.protocol === "http:" ||
                      parsedUrl.protocol === "https:"
                    ) {
                      const imageName = path.basename(parsedUrl.pathname);
                      const imagePath = path.join("imagenes", imageName);
                      const relativePath = `./imagenes/${imageName}`;
                      if (!fs.existsSync(imagePath)) {
                        fetchImage(imgSrc, imagePath);
                      } else {
                        console.log(`La imagen ya existe: ${imagePath}`);
                      }

                      rowData[`${headers[cellIndex]}_id`] = titleValue;
                      rowData[`${headers[cellIndex]}_img`] = relativePath;
                    } else {
                      console.error(`URL de imagen no válida: ${imgSrc}`);
                    }
                  }
                } else {
                  console.log(`La imagen ya existe: ${imagePath}`);
                }
                rowData[`${headers[cellIndex]}_id`] = titleValue;

                rowData[`${headers[cellIndex]}_img`] = relativePath;
              }

              rowData[headers[cellIndex]] = $(cell).text().trim();
            });

          jsonData.push(rowData);
        }
      });

      const filePath = path.join(currentDirPath, "output.json");

      let outputData = jsonData;

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        if (fileContent.trim() !== "") {
          const existingData = JSON.parse(fileContent);
          outputData = existingData.concat(jsonData);
        }
      }

      fs.writeFile(filePath, JSON.stringify(outputData, null, 2), (err) => {
        if (err) {
          console.error("Error al escribir el archivo:", err);
        } else {
          console.log(`Archivo JSON guardado correctamente en: ${filePath}`);
        }
      });
    } else {
      console.log("No se encontró una tabla en el portapapeles.");
    }
  }
}, 1000); // Comprueba el portapapeles cada 1 segundos

const fetchImage = async (url, path) => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`unexpected response ${response.statusText}`);
  const streamPipeline = promisify(pipeline);
  return streamPipeline(response.body, fs.createWriteStream(path));
};
