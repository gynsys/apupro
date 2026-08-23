import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../services/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("Verificando tu correo...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Enlace inválido o incompleto.");
      return;
    }

    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Tu correo ha sido verificado exitosamente. Ya puedes iniciar sesión.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Ocurrió un error al verificar tu correo.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100 text-center">
        <div>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900" style={{ fontFamily: "\"Barlow Condensed\", sans-serif" }}>
            Verificación de Correo
          </h2>
        </div>

        <div className={`p-4 rounded-md border ${status === "success" ? "bg-green-50 border-green-200 text-green-800" : status === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
          {message}
        </div>

        {status !== "loading" && (
          <div className="mt-6">
            <Link to="/login" className="font-medium text-white bg-[#1A6BB5] hover:bg-[#134F8A] py-2 px-4 rounded-md transition-colors inline-block">
              Ir a Iniciar Sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
