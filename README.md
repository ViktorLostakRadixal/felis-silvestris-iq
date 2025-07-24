# **Felis Silvestris IQ**

\<\!-- Note: Insert the URL to your uploaded logo here \--\>

**Felis Silvestris IQ is a scientific research project and cognitive testing platform focused on the systematic selective breeding of the domestic cat (*Felis catus*) with the goal of developing its cognitive abilities and intelligence.**

This repository contains the complete source code for the testing application, which serves as the primary tool for collecting objective data within the breeding program.

## **1\. Vision and Strategic Goal**

The primary objective of the project is the selective breeding of cats based not on aesthetic traits, but on measurable behavioral and intellectual characteristics. The long-term vision is to create a line of cats with a demonstrably higher ability to solve problems, learn, and interact with their environment, all while adhering to the strictest ethical standards and ensuring animal welfare.

## **2\. Breeding Strategy**

The project is based on a **matrilineal approach with strategic outcrossing**. This method was chosen after a thorough analysis and the complete rejection of inbreeding as unethical and counterproductive.

* **Focus on Females:** The backbone of the breeding program consists of the most cognitively gifted females, a strategy supported by scientific knowledge about the disproportionate influence of the mother on the cognitive development of offspring.  
* **Strategic Outcrossing:** To ensure genetic diversity and population health, only external, unrelated males are used for mating.  
* **Exclusion of In-house Males:** No male born within the project is used for further breeding in the main line to reliably prevent any form of inbreeding.

## **3\. The Testing Platform: Technical Overview**

The application in this repository is the core of the cognitive assessment methodology.

* **Architecture:** The application is built on **C\# Minimal API** (.NET 8\) and functions as a self-contained web server.  
* **Backend:**  
  * Serves static frontend files (HTML, CSS, JS).  
  * Provides an API endpoint /api/log for receiving and storing experiment data.  
  * Saves all data to a **MongoDB database**.  
* **Frontend:**  
  * A simple web interface written in plain HTML, CSS, and JavaScript.  
  * Utilizes the **Touch Events API** for precise touch detection on touchscreens.  
  * Records a wide spectrum of events: taps (both successful and unsuccessful), viewport size changes, page visibility changes, and more.  
  * Supports fullscreen mode to minimize distractions.

## **4\. Getting Started & Usage**

### **Prerequisites**

* [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)  
* Access to a running instance of **MongoDB**.

### **Steps to Run**

1. **Clone the repository:**  
   git clone https://github.com/your-username/felis-silvestris-iq.git  
   cd felis-silvestris-iq

2. Set up the database connection:  
   In the Program.cs file, find the following line and replace the placeholder with your actual MongoDB connection string:  
   var connectionString \= "mongodb://localhost:27017"; 

3. Run the application:  
   In your terminal, execute the command:  
   dotnet run

   The application will start and listen on the address shown in the console (typically http://localhost:5123 or similar).  
4. **Conduct a test:**  
   * Open the above address in a browser on a device with a touchscreen (ideally a laptop that can be laid flat).  
   * Enter a unique ID for the test session (e.g., the cat's name and the date).  
   * Press "Start Test". The application will switch to fullscreen and begin the experiment.  
   * After the set duration, the test will automatically end, and all collected data will be sent to the server for storage in the database.

### ***Confidential & Proprietary Information***

© 2025 A VIRTÙ RESEARCH & TECHNOLOGIES s.r.o. All rights reserved.

This document and the associated source code are the confidential and proprietary intellectual property of A VIRTÙ RESEARCH & TECHNOLOGIES s.r.o. The information contained herein is for informational purposes only. No part of this project may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the company.

Felis Silvestris™ and Felis Silvestris IQ™ are trademarks of A VIRTÙ RESEARCH & TECHNOLOGIES s.r.o.

A VIRTÙ RESEARCH & TECHNOLOGIES s.r.o.  
Kuršova 978/3, 635 00 Brno-Bystrc, Czech Republic  
IČ (ID): 08428441 | DIČ (VAT): CZ08428441  
E: info@avirtu.net | P: \+420 604 761 154 | Data Box ID: ugkbmy8  
Registered in the Commercial Register kept by the Regional Court in Brno, Section C, Insert 113661\.
