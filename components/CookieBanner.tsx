"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "./ui/button";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("vysify-cookie-consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("vysify-cookie-consent", "true");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
        >
          <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Nós utilizamos cookies essenciais para garantir a sua segurança no login e cookies de analytics para entender como você usa o Vysify, de acordo com a nossa{" "}
              <Link href="/legal/privacy" className="text-violet-600 hover:underline font-medium">
                Política de Privacidade
              </Link>.
            </div>
            <div className="flex shrink-0 gap-3 w-full sm:w-auto">
              <Button onClick={accept} className="w-full sm:w-auto">
                Entendi e Aceito
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
