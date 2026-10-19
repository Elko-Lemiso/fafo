# Build faces.json: hand-picked well-known people, with their lead photo from Wikipedia (free licences only).
# Each entry: Wikipedia title | gender | african (1/0). Display name = title without "(...)".
# Wikidata adds each person's birth year (b), country (cc) and its region (rg, sr). The game uses those to pick
# wrong answers that could pass for the right one: same job, same part of the world, same era.
import json, re, sys, time, urllib.parse, urllib.request

UA = "fafo-party-game/1.0 (https://github.com/Elko-Lemiso/fafo)"
PEOPLE = {
"music": """
Michael Jackson|m|0;Madonna|f|0;Beyoncé|f|0;Rihanna|f|0;Taylor Swift|f|0;Adele|f|0;Lady Gaga|f|0;Shakira|f|0;Ed Sheeran|m|0;
Drake (musician)|m|0;Kanye West|m|0;Eminem|m|0;Jay-Z|m|0;Bruno Mars|m|0;Justin Bieber|m|0;Ariana Grande|f|0;Billie Eilish|f|0;
Bob Marley|m|0;Elvis Presley|m|0;Whitney Houston|f|0;Celine Dion|f|0;Mariah Carey|f|0;Freddie Mercury|m|0;John Lennon|m|0;
Paul McCartney|m|0;David Bowie|m|0;Prince (musician)|m|0;Tina Turner|f|0;Elton John|m|0;Dolly Parton|f|0;Snoop Dogg|m|0;
Tupac Shakur|m|0;The Weeknd|m|0;Dua Lipa|f|0;Harry Styles|m|0;Cardi B|f|0;Nicki Minaj|f|0;Alicia Keys|f|0;Usher (musician)|m|0;
Post Malone|m|0;Kendrick Lamar|m|0;SZA|f|0;Doja Cat|f|0;Frank Sinatra|m|0;Stevie Wonder|m|0;Bob Dylan|m|0;Mick Jagger|m|0;
Bad Bunny|m|0;Lizzo|f|0;Chris Brown|m|0;Olivia Rodrigo|f|0;Sabrina Carpenter|f|0;Travis Scott|m|0;50 Cent|m|0;Pharrell Williams|m|0;
Lionel Richie|m|0;Janet Jackson|f|0;Aretha Franklin|f|0;Louis Armstrong|m|0;Jimi Hendrix|m|0;Kurt Cobain|m|0;Selena Gomez|f|0;
Miley Cyrus|f|0;Katy Perry|f|0;Jennifer Lopez|f|0;Britney Spears|f|0;
Burna Boy|m|1;Wizkid|m|1;Davido|m|1;Tems (singer)|f|1;Rema (musician)|m|1;Tiwa Savage|f|1;Yemi Alade|f|1;Diamond Platnumz|m|1;
Fally Ipupa|m|1;Angélique Kidjo|f|1;Miriam Makeba|f|1;Fela Kuti|m|1;Youssou N'Dour|m|1;Black Coffee (DJ)|m|1;Ayra Starr|f|1;
Asake|m|1;Mr Eazi|m|1;Harmonize (musician)|m|1;Ali Kiba|m|1;Zuchu|f|1;Koffi Olomide|m|1;Salif Keita|m|1;Hugh Masekela|m|1;
Brenda Fassie|f|1;Lucky Dube|m|1;Nasty C|m|1;Cassper Nyovest|m|1;Tyla (singer)|f|1;Otile Brown|m|1;Nyashinski|m|1;Akothee|f|1;
Willy Paul|m|1;Bien-Aimé Baraza|m|1;Jose Chameleone|m|1;Bobi Wine|m|1;Eddy Kenzo|m|1;Khaligraph Jones|m|1;Octopizzo|m|1;Nameless (musician)|m|1;
John Coltrane|m|0;Miles Davis|m|0;Ella Fitzgerald|f|0;Nina Simone|f|0;Billie Holiday|f|0;Duke Ellington|m|0;Ray Charles|m|0;
James Brown|m|0;Marvin Gaye|m|0;Otis Redding|m|0;Amy Winehouse|f|0;Chuck Berry|m|0;B.B. King|m|0;Johnny Cash|m|0;Peter Tosh|m|0;
Jimmy Cliff|m|0;Celia Cruz|f|0;Luciano Pavarotti|m|0;Andrea Bocelli|m|0;Herbie Hancock|m|0;Quincy Jones|m|0;Sade (singer)|f|0;
Erykah Badu|f|0;Lauryn Hill|f|0;Missy Elliott|f|0;The Notorious B.I.G.|m|0;Ice Cube|m|0;Dr. Dre|m|0;Bruce Springsteen|m|0;
Jon Bon Jovi|m|0;Ozzy Osbourne|m|0;Shania Twain|f|0;Little Richard|m|0;Diana Ross|f|0;Smokey Robinson|m|0;Nat King Cole|m|0;
Dizzy Gillespie|m|0;Charlie Parker|m|0;Thelonious Monk|m|0;Sarah Vaughan|f|0;Etta James|f|0;Sam Cooke|m|0;Bill Withers|m|0;
Al Green|m|0;Rosalía|f|0;J Balvin|m|0;Daddy Yankee|m|0;Karol G|f|0;Marc Anthony|m|0;Enrique Iglesias|m|0;Ricky Martin|m|0;
Oliver Mtukudzi|m|1;Papa Wemba|m|1;Manu Dibango|m|1;Cesária Évora|f|1;Mbilia Bel|f|1;Franco Luambo|m|1;
Garth Brooks|m|0;Willie Nelson|m|0;Kenny Rogers|m|0;Carrie Underwood|f|0;Reba McEntire|f|0;Luke Combs|m|0;Morgan Wallen|m|0;
Tim McGraw|m|0;Faith Hill|f|0;Keith Urban|m|0;Blake Shelton|m|0;Miranda Lambert|f|0;Bono|m|0;Chris Martin|m|0;Dave Grohl|m|0;
Robert Plant|m|0;Steven Tyler|m|0;Axl Rose|m|0;Slash (musician)|m|0;Brian May|m|0;Eddie Vedder|m|0;Stevie Nicks|f|0;Joan Jett|f|0;
Pink (singer)|f|0;Avril Lavigne|f|0;Chester Bennington|m|0;Billie Joe Armstrong|m|0;Lenny Kravitz|m|0;Sting (musician)|m|0
""",
"screen": """
Leonardo DiCaprio|m|0;Brad Pitt|m|0;Angelina Jolie|f|0;Tom Cruise|m|0;Will Smith|m|0;Denzel Washington|m|0;Morgan Freeman|m|0;
Scarlett Johansson|f|0;Jennifer Lawrence|f|0;Meryl Streep|f|0;Tom Hanks|m|0;Johnny Depp|m|0;Dwayne Johnson|m|0;Keanu Reeves|m|0;
Robert Downey Jr.|m|0;Chris Hemsworth|m|0;Zendaya|f|0;Margot Robbie|f|0;Emma Watson|f|0;Viola Davis|f|0;Samuel L. Jackson|m|0;
Jackie Chan|m|0;Shah Rukh Khan|m|0;Priyanka Chopra|f|0;Idris Elba|m|0;Chadwick Boseman|m|0;Kevin Hart|m|0;Jim Carrey|m|0;
Julia Roberts|f|0;Nicole Kidman|f|0;Ryan Reynolds|m|0;Hugh Jackman|m|0;Timothée Chalamet|m|0;Tom Holland|m|0;Gal Gadot|f|0;
Jennifer Aniston|f|0;Sandra Bullock|f|0;Halle Berry|f|0;Arnold Schwarzenegger|m|0;Sylvester Stallone|m|0;Marilyn Monroe|f|0;
Audrey Hepburn|f|0;Charlie Chaplin|m|0;Pedro Pascal|m|0;Cillian Murphy|m|0;Anne Hathaway|f|0;Rowan Atkinson|m|0;Emma Stone|f|0;
Oprah Winfrey|f|0;Ellen DeGeneres|f|0;Steve Harvey|m|0;Gordon Ramsay|m|0;Kim Kardashian|f|0;Kylie Jenner|f|0;MrBeast|m|0;
Khaby Lame|m|0;Naomi Campbell|f|0;Tyra Banks|f|0;Jimmy Fallon|m|0;Will Ferrell|m|0;Morgan Freeman|m|0;
Lupita Nyong'o|f|1;Trevor Noah|m|1;Daniel Kaluuya|m|0;Genevieve Nnaji|f|1;Omotola Jalade Ekeinde|f|1;Elsa Majimbo|f|1;
Charlize Theron|f|1;Thuso Mbedu|f|1;Funke Akindele|f|1;
Jet Li|m|0;Donnie Yen|m|0;Chow Yun-fat|m|0;Bruce Lee|m|0;Michelle Yeoh|f|0;Lucy Liu|f|0;Ken Watanabe|m|0;Simu Liu|m|0;Awkwafina|f|0;
Gong Li|f|0;Zhang Ziyi|f|0;Lee Byung-hun|m|0;Laurence Fishburne|m|0;Forest Whitaker|m|0;Jamie Foxx|m|0;Eddie Murphy|m|0;
Wesley Snipes|m|0;Don Cheadle|m|0;Danny Glover|m|0;Michael B. Jordan|m|0;John Boyega|m|0;Mahershala Ali|m|0;Chiwetel Ejiofor|m|0;
Djimon Hounsou|m|1;Taraji P. Henson|f|0;Angela Bassett|f|0;Regina King|f|0;Octavia Spencer|f|0;Whoopi Goldberg|f|0;Kerry Washington|f|0;
Aamir Khan|m|0;Salman Khan|m|0;Hrithik Roshan|m|0;Amitabh Bachchan|m|0;Deepika Padukone|f|0;Aishwarya Rai Bachchan|f|0;Katrina Kaif|f|0;
Matt Damon|m|0;Mark Wahlberg|m|0;Ben Affleck|m|0;Chris Pratt|m|0;Chris Evans (actor)|m|0;Chris Pine|m|0;Ryan Gosling|m|0;Bradley Cooper|m|0;
Jake Gyllenhaal|m|0;Christian Bale|m|0;Matthew McConaughey|m|0;George Clooney|m|0;Javier Bardem|m|0;Antonio Banderas|m|0;Jason Statham|m|0;
Vin Diesel|m|0;Jennifer Garner|f|0;Rachel McAdams|f|0;Amy Adams|f|0;Kate Winslet|f|0;Cate Blanchett|f|0;Natalie Portman|f|0;
Keira Knightley|f|0;Mila Kunis|f|0;Kristen Stewart|f|0;Jessica Alba|f|0;Eva Mendes|f|0;Salma Hayek|f|0;Penélope Cruz|f|0;Sofía Vergara|f|0;
Richard Mofe-Damijo|m|1;Ramsey Nouah|m|1;Pete Edochie|m|1;Rita Dominic|f|1;Mercy Johnson|f|1;Nse Ikpe-Etim|f|1;Sarah Hassan|f|1;Edi Gathegi|m|1
""",
"sport": """
Cristiano Ronaldo|m|0;Lionel Messi|m|0;Neymar|m|0;Kylian Mbappé|m|0;Erling Haaland|m|0;LeBron James|m|0;Michael Jordan|m|0;
Kobe Bryant|m|0;Stephen Curry|m|0;Serena Williams|f|0;Venus Williams|f|0;Roger Federer|m|0;Rafael Nadal|m|0;Novak Djokovic|m|0;
Usain Bolt|m|0;Muhammad Ali|m|0;Mike Tyson|m|0;Tiger Woods|m|0;Lewis Hamilton|m|0;Michael Schumacher|m|0;Simone Biles|f|0;
Michael Phelps|m|0;Naomi Osaka|f|0;Conor McGregor|m|0;Pelé|m|0;Diego Maradona|m|0;Zinedine Zidane|m|0;David Beckham|m|0;
Ronaldinho|m|0;Shaquille O'Neal|m|0;Floyd Mayweather Jr.|m|0;Megan Rapinoe|f|0;Virat Kohli|m|0;Sachin Tendulkar|m|0;
Coco Gauff|f|0;Alex Morgan|f|0;Shelly-Ann Fraser-Pryce|f|0;Sha'Carri Richardson|f|0;Max Verstappen|m|0;Jude Bellingham|m|0;
Mohamed Salah|m|1;Didier Drogba|m|1;Samuel Eto'o|m|1;Sadio Mané|m|1;Riyad Mahrez|m|1;Achraf Hakimi|m|1;Victor Osimhen|m|1;
Francis Ngannou|m|1;Haile Gebrselassie|m|1;Mo Farah|m|1;Caster Semenya|f|1;Eliud Kipchoge|m|1;Faith Kipyegon|f|1;
David Rudisha|m|1;Victor Wanyama|m|1;Mary Keitany|f|1;Paul Tergat|m|1;Kelvin Kiptum|m|1;Ferdinand Omanyala|m|1;
Beatrice Chebet|f|1;Hellen Obiri|f|1;Tirunesh Dibaba|f|1;Kenenisa Bekele|m|1;George Weah|m|1;Yaya Touré|m|1;Jay-Jay Okocha|m|1;
Harry Kane|m|0;Kevin De Bruyne|m|0;Luka Modrić|m|0;Robert Lewandowski|m|0;Karim Benzema|m|0;Antoine Griezmann|m|0;Vinícius Júnior|m|0;
Son Heung-min|m|0;Thierry Henry|m|0;Wayne Rooney|m|0;Steven Gerrard|m|0;Andrés Iniesta|m|0;Xavi|m|0;Sergio Ramos|m|0;Gareth Bale|m|0;
Luis Suárez|m|0;Zlatan Ibrahimović|m|0;Ronaldo (Brazilian footballer)|m|0;Kaká|m|0;Paul Pogba|m|0;N'Golo Kanté|m|0;
Pierre-Emerick Aubameyang|m|1;Michael Essien|m|1;Nwankwo Kanu|m|1;Kevin Durant|m|0;Giannis Antetokounmpo|m|0;Magic Johnson|m|0;
Kareem Abdul-Jabbar|m|0;Dwyane Wade|m|0;Joel Embiid|m|1;Luka Dončić|m|0;Carl Lewis|m|0;Florence Griffith Joyner|f|0;Allyson Felix|f|0;
Noah Lyles|m|0;Andy Murray|m|0;Maria Sharapova|f|0;Carlos Alcaraz|m|0;Iga Świątek|f|0;Anthony Joshua|m|0;Tyson Fury|m|0;
Manny Pacquiao|m|0;Elaine Thompson-Herah|f|0;Sydney McLaughlin-Levrone|f|0;Brigid Kosgei|f|1;Vivian Cheruiyot|f|1;
Catherine Ndereba|f|1;Julius Yego|m|1
""",
"leaders": """
Barack Obama|m|0;Michelle Obama|f|0;Donald Trump|m|0;Joe Biden|m|0;Kamala Harris|f|0;Elizabeth II|f|0;Charles III|m|0;
Vladimir Putin|m|0;Xi Jinping|m|0;Angela Merkel|f|0;Emmanuel Macron|m|0;Narendra Modi|m|0;Justin Trudeau|m|0;
Volodymyr Zelenskyy|m|0;Mahatma Gandhi|m|0;Martin Luther King Jr.|m|0;Winston Churchill|m|0;John F. Kennedy|m|0;
Abraham Lincoln|m|0;Malala Yousafzai|f|0;14th Dalai Lama|m|0;Pope Francis|m|0;Diana, Princess of Wales|f|0;
William, Prince of Wales|m|0;Fidel Castro|m|0;Che Guevara|m|0;Kim Jong Un|m|0;Margaret Thatcher|f|0;Rosa Parks|f|0;
Malcolm X|m|0;Mother Teresa|f|0;Greta Thunberg|f|0;Jacinda Ardern|f|0;Boris Johnson|m|0;Hillary Clinton|f|0;Bill Clinton|m|0;
Nelson Mandela|m|1;Kofi Annan|m|1;Paul Kagame|m|1;Samia Suluhu Hassan|f|1;Julius Nyerere|m|1;Yoweri Museveni|m|1;
Bola Tinubu|m|1;Cyril Ramaphosa|m|1;Ellen Johnson Sirleaf|f|1;Thomas Sankara|m|1;Kwame Nkrumah|m|1;Haile Selassie|m|1;
Desmond Tutu|m|1;Abiy Ahmed|m|1;John Magufuli|m|1;William Ruto|m|1;Uhuru Kenyatta|m|1;Jomo Kenyatta|m|1;Raila Odinga|m|1;
Wangari Maathai|f|1;Mwai Kibaki|m|1;Daniel arap Moi|m|1;Ngozi Okonjo-Iweala|f|1;Winnie Madikizela-Mandela|f|1;Patrice Lumumba|m|1
""",
"science": """
Albert Einstein|m|0;Marie Curie|f|0;Stephen Hawking|m|0;Nikola Tesla|m|0;Elon Musk|m|0;Bill Gates|m|0;Steve Jobs|m|0;
Mark Zuckerberg|m|0;Jeff Bezos|m|0;Warren Buffett|m|0;Tim Cook|m|0;Sundar Pichai|m|0;Jack Ma|m|0;Larry Page|m|0;
Sergey Brin|m|0;Neil Armstrong|m|0;Buzz Aldrin|m|0;Yuri Gagarin|m|0;Jane Goodall|f|0;David Attenborough|m|0;Carl Sagan|m|0;
Neil deGrasse Tyson|m|0;Thomas Edison|m|0;Alexander Graham Bell|m|0;Charles Darwin|m|0;Sigmund Freud|m|0;Katherine Johnson|f|0;
Rosalind Franklin|f|0;Alan Turing|m|0;Tim Berners-Lee|m|0;Sam Altman|m|0;Jensen Huang|m|0;Satya Nadella|m|0;Mae Jemison|f|0;
Sally Ride|f|0;Valentina Tereshkova|f|0;Richard Feynman|m|0;Oprah Winfrey|f|0;Steve Wozniak|m|0;Melinda French Gates|f|0;
Aliko Dangote|m|1;Strive Masiyiwa|m|1;Patrice Motsepe|m|1;Mo Ibrahim|m|1;Philip Emeagwali|m|1
""",
"arts": """
Pablo Picasso|m|0;Frida Kahlo|f|0;Salvador Dalí|m|0;Andy Warhol|m|0;Vincent van Gogh|m|0;Jean-Michel Basquiat|m|0;
Claude Monet|m|0;Georgia O'Keeffe|f|0;Yayoi Kusama|f|0;Ai Weiwei|m|0;Maya Angelou|f|0;J. K. Rowling|f|0;Stephen King|m|0;
Toni Morrison|f|0;Ernest Hemingway|m|0;Mark Twain|m|0;Agatha Christie|f|0;George Orwell|m|0;Paulo Coelho|m|0;
Gabriel García Márquez|m|0;Virginia Woolf|f|0;Oscar Wilde|m|0;Charles Dickens|m|0;Leo Tolstoy|m|0;Coco Chanel|f|0;
Karl Lagerfeld|m|0;Virgil Abloh|m|0;Stan Lee|m|0;Walt Disney|m|0;Steven Spielberg|m|0;Quentin Tarantino|m|0;
Alfred Hitchcock|m|0;Christopher Nolan|m|0;Hayao Miyazaki|m|0;Martin Scorsese|m|0;Banksy|m|0;Keith Haring|m|0;
Chinua Achebe|m|1;Ngũgĩ wa Thiong'o|m|1;Chimamanda Ngozi Adichie|f|1;Wole Soyinka|m|1;Naguib Mahfouz|m|1;
El Anatsui|m|1;Esther Mahlangu|f|1;Ousmane Sembène|m|1;Binyavanga Wainaina|m|1;Yvonne Adhiambo Owuor|f|1
""",
}
# People who are easy to mix up at a glance, so a wrong answer can pass for the right one. Each line is one group; someone
# can be in several. The game scores a shared group above job, country and era.
LOOK = """
Samuel L. Jackson;Morgan Freeman;Laurence Fishburne;Danny Glover;Forest Whitaker;Denzel Washington
Denzel Washington;Wesley Snipes;Don Cheadle;Jamie Foxx;Will Smith;Eddie Murphy;Idris Elba
Chadwick Boseman;Michael B. Jordan;Mahershala Ali;John Boyega;Daniel Kaluuya;Chiwetel Ejiofor;Idris Elba;Djimon Hounsou
Viola Davis;Angela Bassett;Regina King;Octavia Spencer;Taraji P. Henson;Whoopi Goldberg;Oprah Winfrey
Lupita Nyong'o;Thuso Mbedu;Sarah Hassan;Genevieve Nnaji;Rita Dominic;Kerry Washington;Zendaya
Halle Berry;Kerry Washington;Zendaya;Tyra Banks;Naomi Campbell
Jackie Chan;Jet Li;Donnie Yen;Chow Yun-fat;Bruce Lee
Michelle Yeoh;Gong Li;Zhang Ziyi;Lucy Liu;Awkwafina
Shah Rukh Khan;Aamir Khan;Salman Khan;Hrithik Roshan;Amitabh Bachchan
Priyanka Chopra;Deepika Padukone;Aishwarya Rai Bachchan;Katrina Kaif
Brad Pitt;Matt Damon;Leonardo DiCaprio;Ryan Gosling;Chris Pine;Chris Evans;Chris Hemsworth;Chris Pratt;Bradley Cooper;Jake Gyllenhaal
Tom Hanks;George Clooney;Tom Cruise;Johnny Depp;Keanu Reeves;Matthew McConaughey;Christian Bale
Dwayne Johnson;Vin Diesel;Jason Statham;Arnold Schwarzenegger;Sylvester Stallone
Jennifer Aniston;Jennifer Garner;Rachel McAdams;Amy Adams;Julia Roberts;Sandra Bullock;Nicole Kidman;Cate Blanchett;Kate Winslet
Scarlett Johansson;Margot Robbie;Jennifer Lawrence;Emma Stone;Kristen Stewart;Emma Watson;Natalie Portman;Keira Knightley;Mila Kunis;Anne Hathaway
Salma Hayek;Penélope Cruz;Sofía Vergara;Eva Mendes;Jessica Alba;Gal Gadot
Beyoncé;Rihanna;Alicia Keys;Janet Jackson;Mariah Carey;Whitney Houston;SZA;Doja Cat;Tems;Tiwa Savage;Ayra Starr;Tyla
Kanye West;Jay-Z;Drake;Kendrick Lamar;Pharrell Williams;50 Cent;Snoop Dogg;Tupac Shakur;Ice Cube;Chris Brown;Usher;The Weeknd
Taylor Swift;Sabrina Carpenter;Olivia Rodrigo;Selena Gomez;Miley Cyrus;Katy Perry;Britney Spears;Ariana Grande;Billie Eilish;Dua Lipa;Lady Gaga
Ed Sheeran;Harry Styles;Justin Bieber;Post Malone;Bruno Mars;Chris Martin
John Coltrane;Miles Davis;Charlie Parker;Dizzy Gillespie;Thelonious Monk;Herbie Hancock;Duke Ellington;Louis Armstrong;Quincy Jones
Ella Fitzgerald;Billie Holiday;Nina Simone;Sarah Vaughan;Etta James;Aretha Franklin
Marvin Gaye;Otis Redding;Sam Cooke;Al Green;Bill Withers;Smokey Robinson;Stevie Wonder;Lionel Richie;Ray Charles
Bob Marley;Peter Tosh;Jimmy Cliff;Lucky Dube
Mick Jagger;Steven Tyler;Robert Plant;Axl Rose;Ozzy Osbourne;Bono;Freddie Mercury;David Bowie
Bad Bunny;J Balvin;Daddy Yankee;Ricky Martin;Marc Anthony;Enrique Iglesias
Shakira;Jennifer Lopez;Karol G;Rosalía;Celia Cruz
Garth Brooks;Kenny Rogers;Willie Nelson;Tim McGraw;Keith Urban;Blake Shelton;Luke Combs;Morgan Wallen
LeBron James;Kevin Durant;Stephen Curry;Kobe Bryant;Michael Jordan;Dwyane Wade;Magic Johnson;Shaquille O'Neal;Kareem Abdul-Jabbar;Joel Embiid;Giannis Antetokounmpo
Usain Bolt;Carl Lewis;Noah Lyles;Ferdinand Omanyala
Serena Williams;Venus Williams;Coco Gauff;Naomi Osaka
Roger Federer;Rafael Nadal;Novak Djokovic;Andy Murray;Carlos Alcaraz
Cristiano Ronaldo;Lionel Messi;Neymar;Kylian Mbappé;Erling Haaland;Harry Kane;Kevin De Bruyne;Robert Lewandowski;Luka Modrić;Jude Bellingham
Mohamed Salah;Riyad Mahrez;Achraf Hakimi;Karim Benzema
Didier Drogba;Samuel Eto'o;Yaya Touré;Michael Essien;Sadio Mané;Pierre-Emerick Aubameyang;Victor Osimhen;George Weah;Nwankwo Kanu;Jay-Jay Okocha;Victor Wanyama;Paul Pogba;N'Golo Kanté;Thierry Henry
Muhammad Ali;Mike Tyson;Floyd Mayweather Jr.;Anthony Joshua;Francis Ngannou
Simone Biles;Shelly-Ann Fraser-Pryce;Sha'Carri Richardson;Allyson Felix;Florence Griffith Joyner;Elaine Thompson-Herah
Nelson Mandela;Desmond Tutu;Kofi Annan;Julius Nyerere;Jomo Kenyatta;Mwai Kibaki;Daniel arap Moi
William Ruto;Uhuru Kenyatta;Raila Odinga;Yoweri Museveni;Paul Kagame;Cyril Ramaphosa;Bola Tinubu;John Magufuli;Abiy Ahmed
Elon Musk;Mark Zuckerberg;Jeff Bezos;Bill Gates;Steve Jobs;Larry Page;Sergey Brin;Sam Altman;Tim Cook;Steve Wozniak
Albert Einstein;Nikola Tesla;Thomas Edison;Alexander Graham Bell;Charles Darwin;Sigmund Freud
Pablo Picasso;Salvador Dalí;Vincent van Gogh;Claude Monet
Chinua Achebe;Wole Soyinka;Ngũgĩ wa Thiong'o;Naguib Mahfouz
"""
CATS = {"music": "Music", "screen": "Film & TV", "sport": "Sport", "leaders": "Leaders", "science": "Science & business", "arts": "Arts & books"}

def api(titles):
    params = {"action": "query", "format": "json", "formatversion": "2", "redirects": "1", "prop": "pageimages|description|pageprops",
              "piprop": "thumbnail|name", "pithumbsize": "640", "pilicense": "free", "titles": "|".join(titles),
              "ppprop": "wikibase_item"}
    req = urllib.request.Request("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["query"]

people, seen = [], set()
for cat, block in PEOPLE.items():
    for item in block.replace("\n", "").split(";"):
        item = item.strip()
        if not item: continue
        title, g, af = item.split("|")
        if title in seen: continue
        seen.add(title)
        people.append({"title": title, "c": cat, "g": g, "af": int(af)})

out, missing = [], []
for i in range(0, len(people), 50):
    batch = people[i:i + 50]
    q = api([p["title"] for p in batch])
    norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
    redir = {r["from"]: r["to"] for r in q.get("redirects", [])}
    pages = {p["title"]: p for p in q["pages"]}
    for p in batch:
        t = norm.get(p["title"], p["title"]); t = redir.get(t, t)
        page = pages.get(t)
        th = (page or {}).get("thumbnail")
        name = (page or {}).get("pageimage", "")
        if not page or page.get("missing") or not th or name.lower().endswith((".svg", ".png")) and "logo" in name.lower():
            missing.append(p["title"]); continue
        if name.lower().endswith(".svg"):
            missing.append(p["title"] + " (svg)"); continue
        out.append({"n": re.sub(r"\s*\(.*\)$", "", p["title"]), "c": p["c"], "g": p["g"], "af": p["af"],
                    "img": th["source"], "w": th["width"], "h": th["height"], "d": (page.get("description") or "")[:80],
                    "q": (page.get("pageprops") or {}).get("wikibase_item", "")})
    time.sleep(0.5)

# ---- Wikidata: birth year and country, then the country's region from the world-countries package.
def wd(ids):
    req = urllib.request.Request("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "wbgetentities", "format": "json", "props": "claims", "ids": "|".join(ids)}), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r).get("entities", {})
def ids_of(claims, prop):
    return [c["mainsnak"]["datavalue"]["value"]["id"] for c in claims.get(prop, []) if c["mainsnak"].get("datavalue")]
claims = {}
qs = [p["q"] for p in out if p.get("q")]
for i in range(0, len(qs), 50):
    for k, e in wd(qs[i:i + 50]).items(): claims[k] = e.get("claims", {})
    time.sleep(0.3)
countries = sorted({c for cl in claims.values() for c in ids_of(cl, "P27")})
iso = {}
for i in range(0, len(countries), 50):
    for k, e in wd(countries[i:i + 50]).items():
        v = e.get("claims", {}).get("P297", [])
        if v and v[0]["mainsnak"].get("datavalue"): iso[k] = v[0]["mainsnak"]["datavalue"]["value"].lower()
    time.sleep(0.3)
import os
wc = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "node_modules", "world-countries", "countries.json")))
where = {c["cca2"].lower(): (c["region"], c["subregion"]) for c in wc}
# Nationality as Wikipedia's description puts it ("Hong Kong martial artist", "Kenyan runner") beats Wikidata's
# citizenship list, which is in no particular order for people with several.
words = {}
for c in wc:
    for w in [c["name"]["common"], *(c.get("demonyms", {}).get("eng", {}) or {}).values()]:
        if w: words[w.lower()] = c["cca2"].lower()
words.update({"english": "gb", "scottish": "gb", "welsh": "gb", "british": "gb", "hong kong": "hk", "american": "us", "soviet": "ru", "congolese": "cd"})
def from_desc(d):
    toks = re.findall(r"[A-Za-z'’.-]+", d or "")
    for n in (3, 2, 1):
        w = " ".join(toks[:n]).lower()
        if w in words: return words[w]
    return ""
# Where neither source gives a usable country.
FIX = {"Lupita Nyong'o": "ke", "Narendra Modi": "in", "14th Dalai Lama": "cn", "Thomas Sankara": "bf", "Haile Selassie": "et"}
# States that no longer exist count as the country that followed them.
GONE = {"Q15180": "ru", "Q36704": "rs", "Q33946": "cz", "Q16957": "de", "Q174193": "gb", "Q161885": "gb", "Q179876": "gb", "Q8680": "gb", "Q83286": "rs", "Q29999": "nl"}
for p in out:
    cl = claims.get(p.pop("q", ""), {})
    born = [c["mainsnak"]["datavalue"]["value"]["time"] for c in cl.get("P569", []) if c["mainsnak"].get("datavalue")]
    if born: p["b"] = int(born[0][1:5]) * (-1 if born[0].startswith("-") else 1)
    pref = sorted(cl.get("P27", []), key=lambda c: c.get("rank") != "preferred")
    cits = [c["mainsnak"]["datavalue"]["value"]["id"] for c in pref if c["mainsnak"].get("datavalue")]
    cc = FIX.get(p["n"]) or from_desc(p["d"]) or next((iso.get(c) or GONE.get(c) for c in cits if iso.get(c) or GONE.get(c)), "")
    if cc: p["cc"] = cc; p["rg"], p["sr"] = where.get(cc, ("", ""))
groups = [[n.strip() for n in line.split(";") if n.strip()] for line in LOOK.strip().splitlines()]
names = {p["n"] for p in out}
for i, g in enumerate(groups):
    for n in g:
        if n not in names: print("  look group", i, "has no", n)
for p in out:
    lk = [i for i, g in enumerate(groups) if p["n"] in g]
    if lk: p["lk"] = lk
print(sum(1 for p in out if "b" in p), "with a birth year;", sum(1 for p in out if p.get("cc")), "with a country;", sum(1 for p in out if p.get("lk")), "in a look-alike group")

json.dump({"cats": CATS, "people": out}, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
print(f"{len(out)} people with photos; missing {len(missing)}: {missing}")
for c in CATS: print(c, sum(1 for p in out if p["c"] == c), "african", sum(1 for p in out if p["c"] == c and p["af"]))
