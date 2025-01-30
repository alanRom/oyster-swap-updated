import { Route, BrowserRouter , Routes as _Routes } from "react-router-dom";
import { ExchangeView } from "./components/exchange";

export function Routes() {
  // TODO: add simple view for sharing ...
  return (
    <>
      <BrowserRouter basename={"/"}>
        <_Routes>
        <Route  path="/" Component={ExchangeView} />

        </_Routes>
      </BrowserRouter>
    </>
  );
}
