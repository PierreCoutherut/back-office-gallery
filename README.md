# Pierre Studio — déploiement Infomaniak

Cette version indépendante utilise Next.js sur Node.js. Elle conserve le back-office, la navigation par galeries/sous-galeries, l’onglet À compléter et la PWA. Elle possède sa propre page de connexion, sans connexion à ChatGPT.

Destination prévue : **https://back-office.pierre-coutherut.fr**.

Dépôt : [PierreCoutherut/back-office-gallery](https://github.com/PierreCoutherut/back-office-gallery), branche `main`.

## Connexion

Utilise l’identifiant et le mot de passe de ton compte sur **l’API photo** (`api.pierre-coutherut.fr`), pas ton compte Infomaniak ni ChatGPT. L’identifiant autorisé est choisi pendant l’installation. Le mot de passe est vérifié directement par l’API et n’est pas enregistré dans le projet.

La session est chiffrée dans un cookie HttpOnly/Secure valable au maximum huit heures, ou moins si le jeton API expire avant. Une déconnexion est accessible dans le studio. Les pages et les appels à l’API vérifient la session. HTTPS est nécessaire.

## 1. Créer le site

Dans le Manager Infomaniak, ouvre ton hébergement, choisis **Ajouter → Technologies avancées → Node.js**, puis renseigne le sous-domaine `back-office.pierre-coutherut.fr`.

Choisis une version **Node.js 24** (ou Node.js 22, version 22.13 minimum). Le sous-domaine doit pointer sur ce site et son certificat SSL doit être activé. Si la zone DNS est gérée ailleurs, reporte les valeurs indiquées par Infomaniak chez le gestionnaire DNS ; aucune adresse IP n’est fixée dans ce projet.

## 2. Importer le code par GitHub en SSH

GitHub héberge le code ; l’application Node tourne chez Infomaniak. GitHub Pages ne convient pas à ce back-office.

Dans le terminal SSH Infomaniak, place-toi dans le **dossier racine du nouveau site** affiché dans le Manager. Remplace le chemin ci-dessous par ce chemin réel :

```bash
cd /chemin/du/site/back-office.pierre-coutherut.fr
git clone https://github.com/PierreCoutherut/back-office-gallery.git studio
cd studio
```

Le dossier `studio` doit être neuf. Le clonage ne remplace pas les éventuels fichiers d’exemple présents à la racine du site. La commande est prévue pour la première installation ; pour une mise à jour, utilise `git pull --ff-only` dans le dossier déjà cloné.

Le dossier d’exécution sera **`./studio`**, contenant directement `package.json`. Ne sélectionne pas `studio/app/`, qui contient seulement les pages de l’application.

Autre possibilité : lors de la création du site, la méthode personnalisée peut importer directement ce dépôt Git, une archive ZIP ou des fichiers SSH/SFTP. Si tu as importé le dépôt directement à la racine via le Manager, ne le clone pas une seconde fois et utilise `./` comme dossier d’exécution.

## 3. Configuration initiale en SSH

Toujours dans le dossier `studio` contenant `package.json`, exécute :

```bash
npm run setup
npm run doctor
```

`setup` fonctionne sans installer les dépendances. Il demande l’adresse HTTPS et ton **identifiant API**, puis génère automatiquement la clé de session. Accepte l’adresse `https://back-office.pierre-coutherut.fr` proposée. Le script crée un fichier `.env` privé avec les permissions `600` et n’écrase jamais un fichier existant.

Le script ne demande pas ton mot de passe : tu le saisiras sur la page de connexion. Le fichier `.env` reste sur le serveur et ne doit pas partir sur GitHub.

Les réglages créés sont :

| Variable | Rôle |
| --- | --- |
| `APP_URL` | Adresse HTTPS exacte du back-office |
| `PHOTO_USERNAME` | Seul compte API autorisé à se connecter |
| `SESSION_SECRET` | Clé aléatoire créée par `setup` |
| `PORT` | Fourni par Infomaniak ; ne le fixe pas dans `.env` |

Les variables déjà définies dans l’environnement Infomaniak priment sur `.env`. Aucun `PHOTO_PASSWORD` ni `ADMIN_PASSWORD_HASH` n’est nécessaire.

## 4. Construire et démarrer

Dans **Paramètres avancés → Node.js**, configure :

| Réglage | Valeur |
| --- | --- |
| Dossier d’exécution | `./studio` après le clonage SSH ci-dessus ; `./` après un import Git direct à la racine |
| Commande de construction | `npm ci --include=dev && npm run build` |
| Commande de lancement | `npm start` |
| Port | Celui attribué par le Manager, transmis via `PORT` |

Lance la construction dans le Manager, puis démarre ou redémarre l’application. Le script écoute sur `0.0.0.0` et reprend automatiquement `PORT`. Il valide la configuration avant de démarrer.

Infomaniak recommande la construction depuis le Manager, qui utilise un environnement dédié. Évite de lancer un second `npm start` en SSH si l’application tourne déjà depuis le Manager.

Ouvre ensuite **https://back-office.pierre-coutherut.fr/login** et connecte-toi avec ton compte API photo. Tes photos restent dans la photothèque actuelle ; aucun transfert d’images ni nouvelle base de données n’est requis.

## 5. Mises à jour

En SSH, dans le dossier `studio` contenant `package.json`, récupère les modifications avant de relancer la construction :

```bash
git pull --ff-only
```

Puis relance `npm ci --include=dev && npm run build` dans le Manager et redémarre. Avec ZIP/SFTP, remplace uniquement les fichiers du code, conserve `.env`, puis reconstruis et redémarre. Ne relance pas `setup` et ne remplace pas la clé de session à chaque mise à jour.

Pour invalider toutes les sessions en cours, génère une nouvelle clé de session sur le serveur et redémarre. Le mot de passe API se gère dans ton système photo existant.

## Dépannage

- **Configuration manquante** : vérifie le dossier courant, puis `npm run doctor`. Ne copie pas le contenu complet de `.env` dans un message ou les logs.
- **Identifiant ou mot de passe incorrect** : utilise le compte API photo ; son identifiant doit correspondre à `PHOTO_USERNAME`.
- **Origine refusée** : `APP_URL` doit être l’adresse HTTPS réellement ouverte, sans chemin supplémentaire. Redémarre après correction.
- **Cookie non conservé** : utilise HTTPS, avec un certificat valide et le même domaine que `APP_URL`.
- **Erreur 502** : consulte les logs du Manager ; vérifie que le build a réussi, que le port est celui fourni et que `api.pierre-coutherut.fr` est joignable.
- **Session expirée** : reconnecte-toi. La durée maximale dépend également de la durée du jeton délivré par ton API.

## Vérification et limites

`npm test` vérifie le chiffrement, l’expiration, les faux en-têtes d’identité, la connexion, les écritures cross-origin, la déconnexion et la limite de tentatives. La limite de connexion est en mémoire pour un processus Node : cette version vise ton instance personnelle Infomaniak.

Le service worker ne stocke ni photos privées, ni réponses API, ni page de connexion. Il conserve seulement une page hors connexion neutre. Les cookies sont propres au nouveau domaine ; l’installation PWA depuis l’ancienne adresse ne migre pas automatiquement.

La version Node.js a été compilée avec Next.js 16.3.8 ; huit tests d’authentification passent et l’audit des dépendances ne signale aucune vulnérabilité au 5 octobre 2026. Le domaine, le certificat et le lancement chez Infomaniak restent à configurer dans ton compte. Les interactions visuelles sur un appareil réel n’ont pas été testées dans cet environnement.

## Documentation officielle consultée le 5 octobre 2026

- [Créer un site Node.js Infomaniak](https://www.infomaniak.com/fr/support/faq/2537/creer-un-site-nodejs-chez-infomaniak)
- [Commandes, dossier d’exécution et PORT](https://www.infomaniak.com/fr/support/faq/2535/modifier-la-configuration-dun-site-nodejs-infomaniak)
- [Hébergement autonome Next.js](https://nextjs.org/docs/app/guides/self-hosting)
