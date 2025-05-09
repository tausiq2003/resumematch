import { app } from "./app";
import dotenv from "dotenv";
dotenv.config({
    path: "./.env",
});

app.listen(process.env.PORT || 8000, function () {
    console.log(`Listening on port ${process.env.PORT}`);
});
