"use client";
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState("");

  useEffect(()=>{
    const locale = Cookies.get('lang') || 'en';
    setSelectedLanguage(languages.find((l) => l.code === locale)!.label)
  },[])

  const changeLanguage = (lang: string) => {
    Cookies.set('lang', lang, { expires: 7 }); // Définit un cookie de langue valide pendant 7 jours
    setSelectedLanguage(languages.find((l) => l.code === lang)!.label);
    router.refresh(); // Recharge la page pour appliquer le changement
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          {selectedLanguage}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-32">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="cursor-pointer"
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
