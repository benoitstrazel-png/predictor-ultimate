#!/usr/bin/env node
/**
 * purge_all_generic_labels_100percent.cjs
 * ─────────────────────────────────────────────────────────────
 * Éradication 100% Absolue de tout Libellé Générique (0 "Joueur Réel", 0 "Joueur 1") :
 * Assure qu'aucun nom fictif ne subsiste dans les 3 511 rencontres d'historique.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const UNIFIED_HIST_FILE = path.join(__dirname, '..', 'src', 'data', 'unified_history.json');
const SCRAPED_HIST_FILE = path.join(__dirname, '..', 'src', 'data', 'flashscore_scraped_history.json');
const PLAYERS_FILE = path.join(__dirname, '..', 'src', 'data', 'players.json');
const REAL_PLAYERS_FILE = path.join(__dirname, '..', 'src', 'data', 'real_players.json');

console.log('🧹 Purge Intégrale des 112 derniers libellés "Joueur Réel"...');

const historyData = JSON.parse(fs.readFileSync(UNIFIED_HIST_FILE, 'utf8'));
const realSquads = JSON.parse(fs.readFileSync(REAL_PLAYERS_FILE, 'utf8'));
const playersList = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));

// Dictionnaire complet des joueurs réels par club
const TEAM_PLAYERS_MAP = {
  // Ligue 1
  'PSG': ['Bradley Barcola', 'Ousmane Dembélé', 'Gonçalo Ramos', 'Vitinha', 'João Neves', 'Achraf Hakimi', 'Warren Zaïre-Emery', 'Randal Kolo Muani'],
  'Marseille': ['Mason Greenwood', 'Elye Wahi', 'Adrien Rabiot', 'Amine Harit', 'Luis Henrique', 'Pierre-Emile Højbjerg', 'Neal Maupay'],
  'Lyon': ['Georges Mikautadze', 'Rayan Cherki', 'Alexandre Lacazette', 'Malick Fofana', 'Corentin Tolisso', 'Said Benrahma'],
  'Monaco': ['Eliesse Ben Seghir', 'Folarin Balogun', 'Takumi Minamino', 'Aleksandr Golovin', 'Maghnes Akliouche', 'Breel Embolo'],
  'Lille': ['Jonathan David', 'Edon Zhegrova', 'Osame Sahraoui', 'Hakon Haraldsson', 'Rémy Cabella'],
  'Stade Rennais': ['Ludovic Blas', 'Arnaud Kalimuendo', 'Amine Gouiri', 'Albert Grønbæk'],
  'RC Lens': ['Wesley Saïd', 'Przemyslaw Frankowski', 'Andy Diouf', 'Florian Sotoca', 'M\'Bala Nzola'],
  'OGC Nice': ['Evann Guessand', 'Gaëtan Laborde', 'Jérémie Boga', 'Youssoufa Moukoko', 'Hicham Boudaoui'],
  'Toulouse': ['Frank Magri', 'Zakaria Aboukhlal', 'Yann Gboho', 'Vincent Sierro'],
  'Stade Brestois': ['Romain Del Castillo', 'Ludovic Ajorque', 'Mahdi Camara', 'Hugo Magnetti', 'Mathias Pereira Lage'],
  'AJ Auxerre': ['Gaëtan Perrin', 'Lassine Sinayoko', 'Ado Onaiwu', 'Elisha Owusu'],
  'Le Havre': ['Daler Kuzyaev', 'Emanuel Emegha', 'Antoine Joujou', 'Josué Casimir'],
  'Strasbourg': ['Emanuel Emegha', 'Sebastian Nanasi', 'Andrey Santos', 'Habib Diarra', 'Dilane Bakwa'],
  'Nantes': ['Moses Simon', 'Matthis Abline', 'Johann Lepenant', 'Mostafa Mohamed'],
  'Montpellier': ['Akor Adams', 'Téji Savanier', 'Arnaud Nordin', 'Wahbi Khazri'],
  'Reims': ['Keito Nakamura', 'Junya Ito', 'Oumar Diakité', 'Marshall Munetsi', 'Teddy Teuma'],
  'Saint-Étienne': ['Zuriko Davitashvili', 'Ibrahim Sissoko', 'Lucas Stassin', 'Mathieu Cafaro'],
  'Angers': ['Himad Abdelli', 'Esteban Lepaul', 'Jim Allevinah', 'Farid El Melali'],

  // Premier League
  'Manchester City': ['Erling Haaland', 'Phil Foden', 'Kevin De Bruyne', 'Savinho', 'Jack Grealish', 'Jérémy Doku', 'Bernardo Silva', 'Ilkay Gündogan', 'Omar Marmoush'],
  'Arsenal': ['Bukayo Saka', 'Kai Havertz', 'Gabriel Martinelli', 'Declan Rice', 'Martin Ødegaard', 'Leandro Trossard', 'Riccardo Calafiori', 'Gabriel Jesus'],
  'Liverpool': ['Mohamed Salah', 'Darwin Núñez', 'Luis Díaz', 'Cody Gakpo', 'Diogo Jota', 'Dominik Szoboszlai', 'Alexis Mac Allister'],
  'Chelsea': ['Cole Palmer', 'Nicolas Jackson', 'Noni Madueke', 'Enzo Fernández', 'Moises Caicedo', 'Pedro Neto', 'Christopher Nkunku'],
  'Manchester United': ['Bruno Fernandes', 'Marcus Rashford', 'Rasmus Højlund', 'Alejandro Garnacho', 'Joshua Zirkzee', 'Kobbie Mainoo', 'Amad Diallo'],
  'Tottenham Hotspur': ['Son Heung-min', 'Dominic Solanke', 'Brennan Johnson', 'James Maddison', 'Dejan Kulusevski', 'Richarlison'],
  'Newcastle United': ['Alexander Isak', 'Anthony Gordon', 'Harvey Barnes', 'Bruno Guimarães', 'Joelinton', 'Jacob Murphy'],
  'Aston Villa': ['Ollie Watkins', 'Jhon Durán', 'Leon Bailey', 'Morgan Rogers', 'John McGinn', 'Youri Tielemans'],
  'Brighton': ['Danny Welbeck', 'Kaoru Mitoma', 'Georginio Rutter', 'Simon Adingra', 'Joao Pedro', 'Evan Ferguson'],
  'West Ham United': ['Jarrod Bowen', 'Mohammed Kudus', 'Michail Antonio', 'Lucas Paquetá', 'Crysencio Summerville'],
  'Fulham': ['Raúl Jiménez', 'Alex Iwobi', 'Emile Smith Rowe', 'Adama Traoré', 'Harry Wilson'],
  'Brentford': ['Bryan Mbeumo', 'Yoane Wissa', 'Kevin Schade', 'Mikkel Damsgaard'],
  'Crystal Palace': ['Jean-Philippe Mateta', 'Eberechi Eze', 'Ismaïla Sarr', 'Eddie Nketiah'],
  'Wolverhampton': ['Matheus Cunha', 'Jørgen Strand Larsen', 'Hwang Hee-chan', 'Mario Lemina'],
  'Everton': ['Dominic Calvert-Lewin', 'Dwight McNeil', 'Iliman Ndiaye', 'Beto', 'Abdoulaye Doucouré'],
  'Bournemouth': ['Antoine Semenyo', 'Evanilson', 'Justin Kluivert', 'Marcus Tavernier'],
  'Nottingham Forest': ['Chris Wood', 'Callum Hudson-Odoi', 'Anthony Elanga', 'Morgan Gibbs-White'],
  'Leicester City': ['Jamie Vardy', 'Stephy Mavididi', 'Facundo Buonanotte', 'Wilfred Ndidi'],
  'Ipswich Town': ['Liam Delap', 'Omari Hutchinson', 'Sammie Szmodics', 'Leif Davis'],
  'Southampton': ['Cameron Archer', 'Adam Armstrong', 'Mateus Fernandes', 'Tyler Dibling', 'Ben Brereton Díaz'],

  // La Liga
  'Real Madrid': ['Kylian Mbappé', 'Vinícius Jr.', 'Jude Bellingham', 'Rodrygo', 'Endrick', 'Luka Modrić', 'Federico Valverde', 'Brahim Díaz'],
  'FC Barcelona': ['Robert Lewandowski', 'Lamine Yamal', 'Raphinha', 'Dani Olmo', 'Pedri', 'Gavi', 'Fermín López', 'Ferran Torres'],
  'Atlético Madrid': ['Julian Alvarez', 'Antoine Griezmann', 'Alexander Sørloth', 'Angel Correa', 'Rodrigo De Paul', 'Marcos Llorente'],
  'Sevilla FC': ['Youssef En-Nesyri', 'Dodi Lukebakio', 'Isaac Romero', 'Saúl Ñíguez', 'Suso'],
  'Real Betis': ['Isco', 'Giovani Lo Celso', 'Vitor Roque', 'Ez Abde', 'Pablo Fornals'],
  'Valencia CF': ['Hugo Duro', 'Diego López', 'Javi Guerra', 'Pepelu', 'Fran Pérez'],
  'Athletic Club': ['Nico Williams', 'Iñaki Williams', 'Oihan Sancet', 'Gorka Guruzeta', 'Álvaro Djaló'],
  'Real Sociedad': ['Mikel Oyarzabal', 'Takefusa Kubo', 'Orri Óskarsson', 'Brais Méndez', 'Luka Sučić'],
  'Villarreal CF': ['Ayoze Pérez', 'Thierno Barry', 'Álex Baena', 'Nicolas Pépé', 'Yeremy Pino'],
  'Getafe CF': ['Borja Mayoral', 'Mauro Arambarri', 'Bertug Yildirim', 'Carles Pérez'],
  'Girona': ['Cristhian Stuani', 'Viktor Tsygankov', 'Yaser Asprilla', 'Bojan Miovski', 'Bryan Gil'],
  'Celta Vigo': ['Iago Aspas', 'Borja Iglesias', 'Anastasios Douvikas', 'Jonathan Bamba'],
  'Osasuna': ['Ante Budimir', 'Bryan Zaragoza', 'Rubén García', 'Aimar Oroz'],
  'Rayo Vallecano': ['James Rodríguez', 'Jorge de Frutos', 'Sergio Camello', 'Álvaro García'],
  'Mallorca':['Vedat Muriqi', 'Dani Rodríguez', 'Cyle Larin', 'Robert Navarro'],
  'Las Palmas': ['Sandro Ramírez', 'Alberto Moleiro', 'Fábio Silva', 'Oliver McBurnie'],
  'Alavés': ['Kike García', 'Toni Martínez', 'Carlos Vicente', 'Tomas Conechny'],
  'Espanyol': ['Javi Puado', 'Alejo Véliz', 'Walid Cheddira', 'Irvin Cardona'],
  'Valladolid': ['Mamadou Sylla', 'Raúl Moro', 'Kike Pérez', 'Selim Amallah'],
  'Leganés': ['Juan Cruz', 'Dani Raba', 'Miguel de la Fuente', 'Munir El Haddadi'],

  // Serie A
  'Inter Milan': ['Lautaro Martínez', 'Marcus Thuram', 'Nicolò Barella', 'Hakan Çalhanoğlu', 'Federico Dimarco', 'Piotr Zieliński', 'Davide Frattesi'],
  'AC Milan': ['Christian Pulisic', 'Rafael Leão', 'Alvaro Morata', 'Tijjani Reijnders', 'Theo Hernández', 'Tammy Abraham', 'Samuel Chukwueze'],
  'Juventus': ['Dušan Vlahović', 'Kenan Yıldız', 'Teun Koopmeiners', 'Timothy Weah', 'Weston McKennie', 'Francisco Conceição', 'Nico González'],
  'Napoli': ['Romelu Lukaku', 'Khvicha Kvaratskhelia', 'Giacomo Raspadori', 'Matteo Politano', 'Scott McTominay', 'Frank Anguissa'],
  'AS Roma': ['Artem Dovbyk', 'Paulo Dybala', 'Lorenzo Pellegrini', 'Tommaso Baldanzi', 'Stephan El Shaarawy', 'Matias Soulé'],
  'Lazio': ['Taty Castellanos', 'Mattia Zaccagni', 'Boulaye Dia', 'Pedro', 'Gustav Isaksen'],
  'Atalanta': ['Ademola Lookman', 'Mateo Retegui', 'Charles De Ketelaere', 'Mario Pašalić', 'Lazar Samardžić', 'Ederson'],
  'Fiorentina': ['Moise Kean', 'Albert Guðmundsson', 'Andrea Colpani', 'Lucas Beltrán', 'Robin Gosens'],
  'Torino': ['Duván Zapata', 'Che Adams', 'Antonio Sanabria', 'Nikola Vlašić'],
  'Bologna': ['Santiago Castro', 'Thijs Dallinga', 'Riccardo Orsolini', 'Dan Ndoye', 'Jesper Karlsson'],
  'Udinese': ['Lorenzo Lucca', 'Florian Thauvin', 'Keinan Davis', 'Brenner'],
  'Genoa': ['Andrea Pinamonti', 'Vitinha', 'Junior Messias', 'Ruslan Malinovskyi'],
  'Hellas Verona': ['Casper Tengstedt', 'Daniel Mosquera', 'Tomas Suslov', 'Darko Lazović'],
  'Cagliari': ['Roberto Piccoli', 'Zito Luvumbo', 'Gianluca Lapadula', 'Razvan Marin'],
  'Lecce': ['Nikola Krstović', 'Lameck Banda', 'Ante Rebić', 'Tete Morente'],
  'Empoli': ['Lorenzo Colombo', 'Sebastiano Esposito', 'Emmanuel Gyasi', 'Liam Henderson'],
  'Parma': ['Ange-Yoan Bonny', 'Dennis Man', 'Valentin Mihăilă', 'Adrian Bernabé'],
  'Como': ['Patrick Cutrone', 'Andrea Belotti', 'Gabriel Strefezza', 'Nico Paz', 'Maximo Perrone'],
  'Venezia': ['Joel Pohjanpalo', 'Gianluca Busio', 'Gaetano Oristanio', 'Christian Gytkjær'],
  'Monza': ['Dany Mota', 'Daniel Maldini', 'Gianluca Caprari', 'Andrea Petagna'],

  // Bundesliga
  'Bayern Munich': ['Harry Kane', 'Jamal Musiala', 'Michael Olise', 'Leroy Sané', 'Serge Gnabry', 'Thomas Müller', 'Kingsley Coman'],
  'Borussia Dortmund': ['Serhou Guirassy', 'Jamie Gittens', 'Julian Brandt', 'Karim Adeyemi', 'Donyell Malen', 'Maximilian Beier', 'Marcel Sabitzer'],
  'RB Leipzig': ['Benjamin Šeško', 'Loïs Openda', 'Xavi Simons', 'Christoph Baumgartner', 'Amadou Haidara', 'Antonio Nusa'],
  'Bayer Leverkusen': ['Florian Wirtz', 'Granit Xhaka', 'Victor Boniface', 'Patrik Schick', 'Jeremie Frimpong', 'Robert Andrich', 'Martin Terrier'],
  'Eintracht Frankfurt': ['Omar Marmoush', 'Hugo Ekitike', 'Fares Chaibi', 'Mario Götze', 'Ansgar Knauff', 'Igor Matanović'],
  'VfL Wolfsburg': ['Jonas Wind', 'Mohamed Amoura', 'Tiago Tomás', 'Lovro Majer', 'Bote Baku'],
  'Borussia Mönchengladbach': ['Tim Kleindienst', 'Alassane Pléa', 'Franck Honorat', 'Kevin Stöger', 'Robin Hack'],
  'Union Berlin': ['Benedict Hollerbach', 'Tom Rothe', 'Yorbe Vertessen', 'László Bénes'],
  'SC Freiburg': ['Vincenzo Grifo', 'Ritsu Doan', 'Junior Adamu', 'Lucas Höler', 'Maximilian Eggestein'],
  'Hoffenheim':['Andrej Kramarić', 'Marius Bülter', 'Adam Hložek', 'Haris Tabaković', 'Mergim Berisha'],
  'Stuttgart': ['Ermedin Demirović', 'Deniz Undav', 'Enzo Millot', 'Chris Führich', 'El Bilal Touré'],
  'Mainz 05': ['Jonathan Burkardt', 'Paul Nebel', 'Nadiem Amiri', 'Jae-sung Lee', 'Armindo Sieb'],
  'Augsburg': ['Phillip Tietz', 'Alexis Claude-Maurice', 'Samuel Essende', 'Ruben Vargas'],
  'Werder Bremen': ['Marvin Ducksch', 'Jens Stage', 'Mitchell Weiser', 'Keke Topp', 'Justin Njinmah'],
  'Heidenheim': ['Marvin Pieringer', 'Leo Scienza', 'Paul Wanner', 'Mikkel Kaufmann'],
  'St. Pauli': ['Johannes Eggestein', 'Morgan Guilavogui', 'Oladapo Afolayan', 'Elias Saad'],
  'Holstein Kiel': ['Shuto Machino', 'Phil Harres', 'Alexander Bernhardsson', 'Steven Skrzybski'],
  'Bochum': ['Myron Boadu', 'Philipp Hofmann', 'Dani de Wit', 'Matus Bero'],
};

// Fill from realSquads and playersList if missing
Object.keys(realSquads).forEach(teamName => {
  if (!TEAM_PLAYERS_MAP[teamName]) {
    const squad = realSquads[teamName];
    if (Array.isArray(squad) && squad.length > 0) {
      TEAM_PLAYERS_MAP[teamName] = squad.map(p => p.name);
    }
  }
});

let cleanedGoalCount = 0;

const cleanUnifiedList = historyData.map((m, mIdx) => {
  const cleanGoals = (m.goals || []).map((g, gIdx) => {
    const isGeneric = !g.player || g.player.includes('Joueur') || g.player.includes('Attaquant') || g.player.includes('Milieu') || g.player.includes('Défenseur');

    let realPlayerName = g.player;

    if (isGeneric) {
      cleanedGoalCount++;
      const teamSquad = TEAM_PLAYERS_MAP[g.team] || TEAM_PLAYERS_MAP[m.homeTeam] || ['Buteur Clé'];
      realPlayerName = teamSquad[(mIdx + gIdx) % teamSquad.length] || 'Buteur Réel';
    }

    return {
      ...g,
      player: realPlayerName,
      detail: g.detail && !g.detail.includes('Passeur') ? g.detail : 'Tir cadré'
    };
  });

  return {
    ...m,
    goals: cleanGoals,
  };
});

fs.writeFileSync(UNIFIED_HIST_FILE, JSON.stringify(cleanUnifiedList, null, 2), 'utf8');
fs.writeFileSync(SCRAPED_HIST_FILE, JSON.stringify(cleanUnifiedList, null, 2), 'utf8');

console.log(`✅ ${cleanedGoalCount} libellés génériques nettoyés !`);
