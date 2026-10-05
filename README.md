# Pierre Studio — Astro statique

Back-office photo pour **https://back-office.pierre-coutherut.fr**.

Cette version produit un dossier **`dist`** à déposer sur un hébergement Web classique Infomaniak. Le serveur sert des fichiers HTML, CSS et JavaScript : aucun processus Node.js, aucune base de données et aucun fichier `.env` ne sont nécessaires chez l’hébergeur. L’API existante reste hébergée sur `https://api.pierre-coutherut.fr`.

## Compiler sur ton ordinateur

Avec **Node.js 24** et Git installés :

```sh
git clone https://github.com/PierreCoutherut/back-office-gallery.git
cd back-office-gallery
npm ci
npm run build
```

Le dossier **`dist/`** obtenu contient `index.html`, `login/`, `_astro/`, `icons/`, le manifeste PWA, `sw.js` et `.htaccess`. Transfère son contenu chez Infomaniak. Le code source du dépôt sert à modifier et reconstruire l’interface ; il ne doit pas être envoyé comme dossier public du site.

Pour vérifier le code avant compilation : `npm run check` puis `npm test`.

## 1. Préparer le sous-domaine dans Infomaniak

1. Dans le **Manager Infomaniak**, ouvre ton **Hébergement Web**.
2. Dans la gestion des sites, clique sur **Ajouter** et choisis un **espace vierge / site Web classique**.
3. Sélectionne un sous-domaine du domaine existant et indique **`back-office.pierre-coutherut.fr`**.
4. Note le dossier associé au site. Il est normalement `/sites/back-office.pierre-coutherut.fr`, mais le chemin affiché dans ton Manager fait foi.
5. Accepte la mise à jour DNS proposée si la zone est gérée chez Infomaniak. Sinon, reporte les entrées indiquées par le Manager chez ton gestionnaire DNS.

Si le sous-domaine existe déjà comme site Web classique, garde son dossier actuel. S’il a été créé comme site Node.js pour la précédente version, conserve une sauvegarde et fais servir le sous-domaine par un site Web classique. Les anciennes commandes `npm start`, `npm run setup` et la configuration `PORT` ne s’appliquent plus.

Référence : [ajouter un site ou un sous-domaine](https://www.infomaniak.com/fr/support/faq/1988/ajouter-un-site-a-un-hebergement-web).

## 2. Déposer les fichiers

1. Compile le projet avec les commandes ci-dessus pour obtenir **`dist/`**.
2. Ouvre **Hébergement → FTP / SSH → Web FTP** dans le Manager.
3. Entre dans le dossier exact du site `back-office.pierre-coutherut.fr`.
4. Transfère **tout le contenu de `dist/`** dans ce dossier, par Web FTP ou avec ton logiciel FTP.
5. Vérifie que **`index.html` est directement dans le dossier du site**, au même niveau que `login/` et `_astro/`. Il ne faut pas de dossier `dist` intermédiaire.
6. Transfère aussi **`.htaccess`**, qui règle le cache, les types de fichiers et la compression. Il peut être masqué par ton logiciel FTP ; sauvegarde un éventuel fichier existant avant de le remplacer.
7. Si une page provisoire `index.php` existe dans ce seul dossier de back-office, sauvegarde-la puis renomme-la.

Les photos restent dans la photothèque existante. Aucun fichier photo n’est inclus dans `dist` et aucun transfert de photos n’est nécessaire pour installer l’interface.

Référence : [ouvrir Web FTP](https://www.infomaniak.com/fr/support/faq/1130/acceder-rapidement-au-serveur-web-ftp).

## 3. Activer HTTPS

Dans la liste des sites, ouvre le menu du site puis **Installer un certificat**, choisis **Let’s Encrypt** et sélectionne `back-office.pierre-coutherut.fr`. Le DNS doit déjà pointer sur ce site. Active ensuite la redirection vers HTTPS dans les paramètres du site.

Ouvre **https://back-office.pierre-coutherut.fr**. La page de connexion doit s’afficher. HTTPS est nécessaire pour la PWA et pour protéger la transmission de tes identifiants.

Référence : [installer un certificat Let’s Encrypt](https://www.infomaniak.com/fr/support/faq/2130/installer-un-certificat-ssl-gratuit-lets-encrypt-sur-un-site).

## 4. Se connecter et utiliser le studio

Utilise ton **compte de l’API photothèque**, avec son identifiant et son mot de passe. Il ne s’agit pas du compte Infomaniak ou GitHub.

La connexion appelle directement `/auth/login`. Le mot de passe du compte n’est jamais inclus dans le code ni enregistré dans le stockage du navigateur. Le jeton renvoyé par l’API est conservé dans `sessionStorage` pour l’onglet courant, jusqu’à son expiration, avec une limite de huit heures. Après déconnexion ou expiration, la page de connexion revient. Une application statique dépend des contrôles d’accès appliqués par l’API ; cette migration ne modifie pas ces droits.

Les galeries sont affichées en premier, regroupées par tags, puis leurs sous-galeries. La photothèque complète n’est chargée qu’à l’ouverture de **Toutes les photos**. L’index est traité progressivement dans un Web Worker pour éviter de bloquer l’interface, et les grilles n’affichent que les cartes proches de la zone visible.

L’onglet **À compléter** signale :

- les vignettes absentes ou inutilisables ;
- les tags manquants sur les galeries de premier niveau ;
- les statuts de publication non renseignés ou non reconnus ;
- les galeries **privées sans mot de passe**, y compris les sous-galeries.

Les tags et les dates ne sont pas requis pour les sous-galeries. Aucune date n’est imposée par cet onglet. Tu peux saisir un nouveau mot de passe directement dans la ligne concernée, puis cliquer sur **Enregistrer**. Le mot de passe existant n’est pas affiché. Le signalement repose sur la présence du mot de passe indiquée par l’API ; il ne vérifie pas les permissions de ses routes.

La PWA peut être installée via **Installer** ou le menu du navigateur. Sur iPhone, utilise Safari → Partager → Sur l’écran d’accueil. Une connexion internet reste nécessaire pour consulter ou modifier les données ; aucune photo ni réponse API n’est placée dans le cache hors connexion.

## Reconstruire `dist` après une modification

Pour reconstruire sur ton ordinateur, installe **Node.js 24** et Git, puis :

```sh
git clone https://github.com/PierreCoutherut/back-office-gallery.git
cd back-office-gallery
npm ci
npm run check
npm test
npm run build
```

Dépose ensuite **le contenu du nouveau `dist/`** dans le dossier du site. Node.js est utilisé uniquement pour compiler sur ton ordinateur. GitHub conserve le code ; Infomaniak sert le résultat compilé.

Pour une copie déjà clonée :

```sh
git pull --ff-only
npm ci
npm run check
npm test
npm run build
```

`npm run dev` lance le développement local ; `npm run preview` permet de prévisualiser le résultat compilé. Il faut servir les fichiers par HTTP pour un aperçu local, pas ouvrir `index.html` avec un double-clic.

Lors d’une mise à jour, téléverse d’abord les nouveaux fichiers `_astro/`, puis le reste du site, et termine par `index.html` et `login/index.html`. Garde temporairement les anciens fichiers `_astro/` pour les onglets déjà ouverts. Le bouton de déconnexion et les sessions API ne nécessitent aucune configuration supplémentaire sur Infomaniak.

Référence : [compilation et déploiement statique Astro](https://docs.astro.build/en/guides/deploy/).

## Si quelque chose ne s’affiche pas

| Symptôme | Vérification |
| --- | --- |
| Page Infomaniak ou erreur 404 | Le sous-domaine pointe-t-il sur le bon site ? `index.html` est-il directement dans son dossier ? |
| Page sans style ou boutons absents | Le dossier `_astro/` a-t-il été transféré en entier ? Actualise ensuite la page. |
| Erreur sur `/login/` | Vérifie la présence de `login/index.html`. Le site doit être servi comme un site Web classique. |
| Connexion refusée | Vérifie le compte de la photothèque et la disponibilité de `api.pierre-coutherut.fr`. |
| Connexion ou chargement bloqué par CORS | L’API doit autoriser cette origine ainsi que les en-têtes `Authorization` et `Content-Type`. Ces appels étaient autorisés lors de la préparation de cette version. |
| PWA non proposée | Ouvre l’adresse en HTTPS et vérifie que `manifest.webmanifest`, `sw.js` et `icons/` sont présents. |
| Ancienne interface après mise à jour | Ferme puis rouvre la PWA, ou recharge complètement la page dans le navigateur. |

## Validation de cette livraison

La vérification TypeScript, les tests de connexion simulée, de normalisation des galeries, de règles « À compléter » et de lecture progressive de 30 000 fiches photo sont exécutables avec les commandes ci-dessus. La compilation doit produire uniquement des fichiers statiques. Les tests n’envoient aucune modification à la photothèque réelle.

La mise en ligne effective du sous-domaine se fait avec les étapes Infomaniak ci-dessus ; publier ce dépôt sur GitHub ne déploie pas automatiquement le site chez Infomaniak.
